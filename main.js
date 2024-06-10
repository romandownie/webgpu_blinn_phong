import vertWGSL from './vert.js';
import fragWGSL from './frag.js';
import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.min.js'; // TODO, try to import this from node


// add ability to move camera next
// also need to add color and other material properties and light uniforms 

const canvas = document.querySelector('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext('webgpu');

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

//input stuff
let wDown = false;
let aDown = false;
let sDown = false;
let dDown = false;
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
        arrayStride: 4 * 4, // 4 bytes for each float
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x4', // vec4f 
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
  },
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
console.log(camera);
const perspective =  mat4.perspective(
  Math.PI/2.0,
  1,
  1.0,
  2000,
);
console.log(perspective);
//const view = mat4.inverse(camera);
let vp = mat4.multiply(perspective, camera);
console.log(vp);


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
   -10, 0, -10.0, 1.0,
   10, 0, -10.0, 1.0,
   10,  0, 10, 1.0,

   -10, 0, -10.0, 1.0,
   -10, 0, 10.0, 1.0,
   10,  0, 10, 1.0,
]);

const vertexBuffer = device.createBuffer({
  label: "vertex data buffer",
  size: vertexBufferData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexBufferData);

const vpBuffer = device.createBuffer({
  label: "vertex data buffer",
  size: vp.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vpBuffer, 0, vp);

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {binding: 0, resource: {buffer: vpBuffer}},
  ],
});

function frame() {
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
  if (wDown) {
    vec3.add(forwardVector, cameraPos, cameraPos);
    vec3.add(forwardVector, lookAtPoint, lookAtPoint);
    //console.log(camera);
  }
  if (aDown) {
    vec3.add(rightVector, cameraPos, cameraPos);
    vec3.add(rightVector, lookAtPoint, lookAtPoint);
    //console.log(camera);
  }
  if (sDown) {
    vec3.subtract(cameraPos, forwardVector, cameraPos);
    vec3.subtract(lookAtPoint, forwardVector, lookAtPoint);
    //console.log(camera);
  }
  if (dDown) {
    vec3.add(vec3.negate(rightVector), cameraPos, cameraPos);
    vec3.add(vec3.negate(rightVector), lookAtPoint, lookAtPoint);
    //console.log(camera);
  }

  // handle mouse input


  //update matrix and send to buffer
  camera = mat4.lookAt( //makes a view matrix
    cameraPos,
    lookAtPoint,
    [0, 1, 0],
  );
  vp = mat4.multiply(perspective, camera);
  device.queue.writeBuffer(vpBuffer, 0, vp);



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
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(6); // Drawing 6 vertices for now
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
