import vertWGSL from './vert.js';
import fragWGSL from './frag.js';
import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.min.js'; // TODO, try to import this from node
import ObjLoader from './load_obj.js';


// TODO switch mouse movement stuff from movementX and movementY to screenX and screenY deltas, 
// base things off of deltaT so that framerate isn't a factor: implemented but should keep in mind
// also need to add color and other material properties and light uniforms 
// TODO this gui library could be really useful https://github.com/dataarts/dat.gui
// TODO add support for .obj files (done except for uv)
// TODO add support for varying number of textures and textures in general
// TODO this should be good for multiple models: https://www.reddit.com/r/webgpu/comments/trsfbp/questions_in_relation_to_rendering_multiple/


const canvas = document.querySelector('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext('webgpu');

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

//time variables
const infoElem = document.querySelector('#info');
let oldTime = performance.now();
let currTime = oldTime;
//console.log(currTime);
// getting monitor refreshrate, not the best solution but it works pretty well, maybe map it based on common refresh rates
let monitorRefreshRate = 60;
const getRR = async () => {
  const t1 = await new Promise(requestAnimationFrame);
  const t2 = await new Promise(requestAnimationFrame);
  return 1000 / (t2 - t1);
};

const getAverageRR = async (runs = 10) => {
  let totalRR = 0;
  
  for (let i = 0; i < runs; i++) {
    totalRR += await getRR();
  }
  
  return totalRR / runs;
};

// Calling the function to get the average RR
getAverageRR().then(rr => {
  monitorRefreshRate = rr;
});
//console.log(monitorRefreshRate);

function combineVertNormalArr(vert, normal, dest) {
  console.log(vert);
  console.log(normal);
  for (let i = 0; i < dest.byteLength; i++) {
    dest[i*6] = vert[i*3];
    dest[i*6+1] = vert[i*3+1];
    dest[i*6+2] = vert[i*3+2];
    dest[i*6+3] = normal[i*3];
    dest[i*6+4] = normal[i*3+1];
    dest[i*6+5] = normal[i*3+2];
  }
  console.log("newArray: ", dest);
  return dest;
}

//input stuff
let wDown = false;
let aDown = false;
let sDown = false;
let dDown = false;
let lookAtPointTheta = Math.PI/2.0;
let lookAtPointPhi = Math.PI/2.0;
let mSensitivity = 0.003;
let mouseClickDown = false;
let deltaTime = 0.001;
let moveSpeed = 0.050;
let numDrawCalls = 6;
 // collect input from keyboard
window.addEventListener(
  "keydown",
  (event) => {
    
    if (event.defaultPrevented || event.repeat) {
      return;
    }
  
    switch(event.key) {
      case "w":
        {
          //console.log("w pressed.\n");
          wDown = true;
          break;
        }
      case "a":
        {
          //console.log("a pressed.\n");
          aDown = true;
          break;
        }
      case "s":
        {
          //console.log("s pressed.\n");
          sDown = true;
          break;
        }
      case "d":
        {
          //console.log("d pressed.\n");
          dDown = true;
          break;
        }
    }
    event.preventDefault();
  },
  true,
);
window.addEventListener(
  "keyup",
  (event) => {
    
    if (event.defaultPrevented || event.repeat) {
      return;
    }
  
    switch(event.key) {
      case "w":
        {
          //console.log("w released.\n");
          wDown = false;
          break;
        }
      case "a":
        {
          //console.log("a pressed.\n");
          aDown = false;
          break;
        }
      case "s":
        {
          //console.log("s pressed.\n");
          sDown = false;
          break;
        }
      case "d":
        {
          //console.log("d pressed.\n");
          dDown = false;
          break;
        }
    }
    event.preventDefault();
  },
  true,
);
// mouse listener
window.addEventListener( 
  "mousedown", (e) => {
    switch (e.button) {
      case 0:
        // left mouse button
        //console.log("m1 pressed");
        mouseClickDown = true;
        document.body.requestPointerLock(); //turn off cursor
        break;
    }
  }
  
);
window.addEventListener( 
  "mouseup", (e) => {
    switch (e.button) {
      case 0:
        // left mouse button
        //console.log("m1 release");
        mouseClickDown = false;
        document.exitPointerLock(); // bring back the cursor
        break;
    }
  }
  
);
function mouseMovement(event) {
  //console.log(event.movementX);
  //console.log(event.movementY);
  if (mouseClickDown){
    lookAtPointPhi += event.movementY*mSensitivity;
    lookAtPointTheta += event.movementX*mSensitivity;
  }
}
document.addEventListener("mousemove", mouseMovement);

context.configure({
  device,
  format: presentationFormat,
  alphaMode: 'premultiplied',
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: vertWGSL,
    }),
    buffers: [
      {
        arrayStride: 4 * 3 * 2, // 4 bytes for each float, 2 attributes
        attributes: [ 
          { // positions
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3', // vec4f 
          },
          { // normals
            shaderLocation: 1,
            offset: 4*3,
            format: 'float32x3', // vec4f 
          },
        ],
      },
    ],
  },
  fragment: {
    module: device.createShaderModule({
      code: fragWGSL,
    }),
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
    cullMode: 'back',
  },
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
});

const depthTexture = device.createTexture({ // depth buffer
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

// camera and light data
var cameraPos = new Float32Array([
  //278, 273, -800, 0.0,
  0, 20, -20, //just up a bit and back
]);

var lookAtPoint = vec3.normalize([0, 0, 0] - cameraPos);

// TODO could try mat4.lookAT();
let camera = mat4.lookAt( //makes a view matrix
  cameraPos,
  lookAtPoint,
  [0, 1, 0],
);
//onsole.log(camera);
const perspective =  mat4.perspective(
  Math.PI/2.0,
  1, // aspect ratio 1, 1.33, 1.78
  1.0,
  2000,
);
//console.log(perspective);
//const view = mat4.inverse(camera);
let vp = mat4.multiply(perspective, camera);
//console.log(vp);


const lightPos = [
  343.0, 548.8, 227.0, 0.0,
];





// Vertex buffer data
const vertexBufferData = new Float32Array([
  // Floor quad
  // 552.8, 0.0, 0.0, 1.0,
  // 0.0, 0.0, 0.0, 1.0,
  // 0.0, 0.0, 559.2, 1.0,

  // 552.8, 0.0, 0.0, 1.0,
  // 0.0, 0.0, 559.2, 1.0,
  // 549.6, 0.0, 559.2, 1.0,

  // test triangle and filler so it compiles
  // -0.5, -0.5, 0.0, 1.0,
  //  0.5, -0.5, 0.0, 1.0,
  //  0.0,  0.5, 0.0, 1.0,

   //test floor quad
   -10, 0, -10.0,
   10, 0, -10.0,
   10,  0, 10,

   -10, 0, -10.0,
   -10, 0, 10.0,
   10,  0, 10,
]);
const indexBufferData = new Uint16Array([
  1,2,3,
  4,5,6,
]);
const normalBufferData = new Float32Array([
  0, 1, 0,
  0, 1, 0,
  0, 1, 0,

  0, 1, 0,
  0, 1, 0,
  0, 1, 0,
]);

let vertNormalData = new Float32Array(vertexBufferData.byteLength/2); // /4*2
combineVertNormalArr(vertexBufferData, normalBufferData, vertNormalData);
console.log(vertNormalData);

let vertexBuffer = device.createBuffer({ // see if can keep it const TODO
  label: "vertex data buffer",
  size: vertNormalData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertNormalData);
let indexBuffer = device.createBuffer({ // see if can keep it const TODO
  label: "vertex index buffer",
  size: indexBufferData.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(indexBuffer, 0, indexBufferData);
// let normalBuffer = device.createBuffer({ // see if can keep it const TODO
//   label: "vertex index buffer",
//   size: normalBufferData.byteLength,
//   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
// });
// device.queue.writeBuffer(normalBuffer, 0, normalBufferData);

const vpBuffer = device.createBuffer({
  label: "vertex data buffer",
  size: vp.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vpBuffer, 0, vp);

const camBuffer = device.createBuffer({
  label: "camera buffer",
  size: cameraPos.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(camBuffer, 0, cameraPos);

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {binding: 0, resource: {buffer: vpBuffer}},
    {binding: 1, resource: {buffer: camBuffer}},
  ],
});

//// TODO obj testing

let objectLoader = new ObjLoader();
let currObjFile = '';
let bunny = '';
async function loadAndParseObject(filePath) {
  try {
    currObjFile = await objectLoader.load(filePath);
    bunny = objectLoader.parse(currObjFile);
  } catch (error) {
    console.error('Error loading or parsing object:', error);
  }
}

// async obj load
(async () => {
  await loadAndParseObject('./bunny.obj');
  console.log('Loading and parsing of obj complete.');
  console.log(bunny);
  console.log(bunny.positions);

  //update vertexBuffer TODO (just a test for now)
  let bunnyVertNorm = new Float32Array(bunny.positions.byteLength/2);
  combineVertNormalArr(bunny.positions, bunny.normals, bunnyVertNorm);
  vertexBuffer = device.createBuffer({ // see if can keep it const TODO
    label: "vertex data buffer",
    size: bunnyVertNorm.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, bunnyVertNorm);
  indexBuffer = device.createBuffer({ // see if can keep it const TODO
    label: "vertex index buffer",
    size: bunny.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, bunny.indices);
  numDrawCalls = bunny.indices.byteLength/2; // divided by 2 is the right number
  console.log(numDrawCalls);
})();

function frame() {
  // timing
  oldTime = performance.now();
  // create rightVector and forwardVector
  const forwardVector = vec3.create();
  {
    vec3.subtract(cameraPos, lookAtPoint, forwardVector);
    vec3.normalize(forwardVector, forwardVector);
    vec3.negate(forwardVector, forwardVector);
  }
  const rightVector = vec3.create();
  {
    const tempUpVector = vec3.fromValues(0, 1, 0);
    vec3.cross(tempUpVector, forwardVector, rightVector);
    vec3.normalize(rightVector, rightVector);
  }

  // handle keyboard input
  if (deltaTime < 1000/monitorRefreshRate) { // making sure it doesn't go past my refreshrate
    deltaTime = 1000/monitorRefreshRate;
  }
  if (wDown) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], forwardVector, forwardVector);
    vec3.add(forwardVector, cameraPos, cameraPos);
    //vec3.add(forwardVector, lookAtPoint, lookAtPoint);
    //console.log(camera);
  }
  if (aDown) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], rightVector, rightVector);
    vec3.add(rightVector, cameraPos, cameraPos);
    //vec3.add(rightVector, lookAtPoint, lookAtPoint);
    //console.log(camera);
  }
  if (sDown) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], forwardVector, forwardVector);
    vec3.subtract(cameraPos, forwardVector, cameraPos);
    //vec3.subtract(lookAtPoint, forwardVector, lookAtPoint);
    //console.log(camera);
  }
  if (dDown) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], rightVector, rightVector);
    vec3.add(vec3.negate(rightVector), cameraPos, cameraPos);
    //vec3.add(vec3.negate(rightVector), lookAtPoint, lookAtPoint);
    //console.log(rightVector);
  }

  // handle mouse input

  //theta 0 -> 2PI, phi 0 -> PI, technically rho is involved but it's one here x=ρsinϕcosθ y=ρcosϕ z=ρsinϕsinθ
  // 0 is up, pi is down
  //lookAtPointTheta += 0.003;
  //lookAtPointPhi += 0.003;
  lookAtPointTheta = lookAtPointTheta % (Math.PI*2);
  lookAtPointPhi = Math.min(lookAtPointPhi, Math.PI);
  lookAtPointPhi = Math.max(lookAtPointPhi, 0);
  //console.log(lookAtPointTheta);
  //lookAtPointPhi = Math.PI/13;
  let tempVec =vec3.normalize([Math.sin(lookAtPointPhi)*Math.cos(lookAtPointTheta), Math.cos(lookAtPointPhi), Math.sin(lookAtPointPhi)*Math.sin(lookAtPointTheta)]);
  vec3.add(cameraPos, (tempVec), lookAtPoint);
  //console.log((tempVec));
  //console.log(lookAtPoint);


  //update matrix and send to buffer
  camera = mat4.lookAt( //makes a view matrix
    cameraPos,
    lookAtPoint,
    [0, 1, 0],
  );
  vp = mat4.multiply(perspective, camera);
  device.queue.writeBuffer(vpBuffer, 0, vp);
  device.queue.writeBuffer(camBuffer, 0, cameraPos); //update camera as well

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
  
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.setIndexBuffer(indexBuffer, "uint16");
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.drawIndexed(numDrawCalls); // Drawing 6 vertices for now
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);

  //timing
  // for(let i = 0; i < 1000000000; i++) { //inducing fps problems for testing
  //   if (true) {
  //     continue;
  //   }
  // }
  // for(let i = 0; i < 100000000; i++) { //inducing fps problems for testing
  //   if (true) {
  //     continue;
  //   }
  // }
  // for(let i = 0; i < 10000000; i++) { //inducing fps problems for testing
  //   if (true) {
  //     continue;
  //   }
  // }
  // for(let i = 0; i < 1000000; i++) { //inducing fps problems for testing
  //   if (true) {
  //     continue;
  //   }
  // }
  currTime = performance.now();
  deltaTime = (currTime - oldTime);
  //console.log(deltaTime);
  infoElem.textContent = `\
    fps: ${(1000/deltaTime).toFixed(1)}
    ms: ${deltaTime.toFixed(2)}
  `;
  requestAnimationFrame(frame);
  }

requestAnimationFrame(frame);
