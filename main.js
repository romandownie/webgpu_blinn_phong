import vertWGSL from './vert.js';
import fragWGSL from './frag.js';
import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.min.js'; // TODO, try to import this from node
import ObjLoader from './load_obj.js';
import OBJFile from './OBJFile.js';
import JoyStick from './joy.js';


//// TODO TODO CURRENTLY WORKING ON RENDERING MULTIPLE MESHES USING DIFFERENT BINDGROUPS
//// USING THIS AS A REFERENCE, REWRITE TO BE LIKE THIS: https://webgpu.github.io/webgpu-samples/?sample=renderBundles
//// LOOKS LIKE YOU CAN HAVE AN INTERFACE AND HAVE EACH INDIVIDUAL HAVE IT'S OWN BINDGROUP


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

function combineVertNormalArr(vert, normal, tex, vertIndices, normalIndices, texIndices, dest) {
  //console.log(vert);
  //console.log(normal);
  console.log("texIndices", texIndices[0]);
  
  for (let i = 0; i < dest.byteLength; i++) {
    //console.log(indices[i*3])
    dest[i*8] = vert[3*vertIndices[i]];
    dest[i*8+1] = vert[3*vertIndices[i]+1];
    dest[i*8+2] = vert[3*vertIndices[i]+2];
    dest[i*8+3] = normal[3*normalIndices[i]];
    dest[i*8+4] = normal[3*normalIndices[i]+1];
    dest[i*8+5] = normal[3*normalIndices[i]+2];
    dest[i*8+6] = tex[3*texIndices[i]];
    dest[i*8+7] = 1-tex[3*texIndices[i]+1]; // 1 - val because webgpu is upsidedown

    // dest[i*6] = vert[i*3];
    // dest[i*6+1] = vert[i*3+1];
    // dest[i*6+2] = vert[i*3+2];
    // dest[i*6+3] = normal[i*3];
    // dest[i*6+4] = normal[i*3+1];
    // dest[i*6+5] = normal[i*3+2];
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
    if (lookAtPointPhi <= 0.01) {
      lookAtPointPhi = 0.01;
    } else if (lookAtPointPhi >= Math.PI - 0.01) {
      lookAtPointPhi = Math.PI - 0.01;
    }
    lookAtPointTheta += event.movementX*mSensitivity;
  }
}
document.addEventListener("mousemove", mouseMovement);

// mobile touch stuff
//joystick
var joy = new JoyStick('joyDiv');
console.log(joy.GetX());
let lastTouchX = 0;
let lastTouchY = 0;
let isTouching = false;

function touchStart(event) {
  if (event.touches.length === 1) {
    isTouching = true;
    lastTouchX = event.touches[0].clientX;
    lastTouchY = event.touches[0].clientY;
  }
}
document.addEventListener("touchstart", touchStart);

function touchMove(event) {
  if (isTouching && joy.GetX() == 0 && joy.GetY() == 0) {
    const touch = event.touches[0];
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    
    lookAtPointPhi += deltaY * mSensitivity;
    if (lookAtPointPhi <= 0.01) {
      lookAtPointPhi = 0.01;
    } else if (lookAtPointPhi >= Math.PI - 0.01) {
      lookAtPointPhi = Math.PI - 0.01;
    }
    lookAtPointTheta += deltaX * mSensitivity;

    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  }
}
document.addEventListener("touchmove", touchMove);

function touchEnd(event) {
  isTouching = false;
}
document.addEventListener("touchend", touchEnd);



context.configure({
  device,
  format: presentationFormat,
  alphaMode: 'premultiplied',
});



const depthTexture = device.createTexture({ // depth buffer
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

// renderable class
const Renderable = class {
  constructor() {
    this.vertNorm; // GPUBuffer
    this.indices; // GPUBuffer
    this.numDrawCalls; // uint16 array
    this.transform; //mat4x4
    this.bindGroup; // GPUBindGroup
  }
};

let renderablesArray = [];

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
  canvas.width/canvas.height, // aspect ratio 1, 1.33, 1.78
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
const mData = new Float32Array(16); // TODO
// const mArray = [
//   new Float32Array(
//     [ 1, 0, 0, 0,
//       0, 1, 0, 0,
//       0, 0, 1, 0,
//       1, 1, 1, 1]
//   ), 
//   new Float32Array(
//     [ 1, 0, 0, 0,
//       0, 1, 0, 0,
//       0, 0, 1, 0,
//       -2, -2, -2, 1]
//   ),
// ];
const mArray = [ // mainly for testing
  // Identity matrix (no transformation)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]
  ),
  // Translation by (5, 5, 5)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      5, 5, 5, 1]
  ),
  // Translation by (-5, -5, -5)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      -5, -5, -5, 1]
  ),
  // Rotation around the X axis by 45 degrees, translated by (10, 0, 0)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4), 0,
      0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0,
      10, 0, 0, 1]
  ),
  // Rotation around the Y axis by 45 degrees, translated by (0, 10, 0)
  new Float32Array(
    [ Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4), 0,
      0, 1, 0, 0,
      -Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4), 0,
      0, 10, 0, 1]
  ),
  // Rotation around the Z axis by 45 degrees, translated by (0, 0, 10)
  new Float32Array(
    [ Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4), 0, 0,
      Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0, 0,
      0, 0, 1, 0,
      0, 0, 10, 1]
  ),
  // Scaling by (2, 2, 2), translated by (-10, 0, 0)
  new Float32Array(
    [ 2, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      -10, 0, 0, 1]
  ),
  // Scaling by (0.5, 0.5, 0.5), translated by (0, -10, 0)
  new Float32Array(
    [ 0.5, 0, 0, 0,
      0, 0.5, 0, 0,
      0, 0, 0.5, 0,
      0, -10, 0, 1]
  ),
  // Combined translation and scaling, translated by (0, 0, -10)
  new Float32Array(
    [ 2, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0, 0, -10, 1]
  ),
  // Combined translation and rotation (X axis), translated by (5, 5, 5)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4), 0,
      0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0,
      5, 5, 5, 1]
  ),
  // Combined translation and rotation (Y axis), translated by (-5, -5, -5)
  new Float32Array(
    [ Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4), 0,
      0, 1, 0, 0,
      -Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4), 0,
      -5, -5, -5, 1]
  ),
  // Combined translation and rotation (Z axis), translated by (5, -5, 5)
  new Float32Array(
    [ Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4), 0, 0,
      Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0, 0,
      0, 0, 1, 0,
      5, -5, 5, 1]
  ),
  // Combined scaling and rotation (X axis), translated by (-5, 5, -5)
  new Float32Array(
    [ 1, 0, 0, 0,
      0, Math.cos(Math.PI / 4) * 2, -Math.sin(Math.PI / 4) * 2, 0,
      0, Math.sin(Math.PI / 4) * 2, Math.cos(Math.PI / 4) * 2, 0,
      -5, 5, -5, 1]
  ),
  // Combined scaling and rotation (Y axis), translated by (10, 10, 10)
  new Float32Array(
    [ Math.cos(Math.PI / 4) * 2, 0, Math.sin(Math.PI / 4) * 2, 0,
      0, 2, 0, 0,
      -Math.sin(Math.PI / 4) * 2, 0, Math.cos(Math.PI / 4) * 2, 0,
      10, 10, 10, 1]
  ),
  // Combined scaling and rotation (Z axis), translated by (-10, -10, -10)
  new Float32Array(
    [ Math.cos(Math.PI / 4) * 2, -Math.sin(Math.PI / 4) * 2, 0, 0,
      Math.sin(Math.PI / 4) * 2, Math.cos(Math.PI / 4) * 2, 0, 0,
      0, 0, 2, 0,
      -10, -10, -10, 1]
  )
];


let vertNormalData = new Float32Array(vertexBufferData.byteLength/2); // /4*2
combineVertNormalArr(vertexBufferData, normalBufferData, vertexBufferData, vertexBufferData, vertexBufferData, vertexBufferData, vertNormalData);
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

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, 
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {},
    },
    {
      binding: 1, 
      visibility: GPUShaderStage.FRAGMENT,
      buffer: {},
    },
  ],
});


const bindGroup1Layout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0, 
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {},
    },
    {
      binding: 1, 
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {},
    },
    {
      binding: 2, 
      visibility: GPUShaderStage.FRAGMENT,
      texture: {},
    },
  ]
});

const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [
    bindGroupLayout, //group(0)
    bindGroup1Layout, //group(1)
  ]
})

const pipeline = device.createRenderPipeline({
  layout: pipelineLayout,
  vertex: {
    module: device.createShaderModule({
      code: vertWGSL,
    }),
    buffers: [
      {
        arrayStride: 4 * 3 * 2 + 4*2*1, // 4 bytes for each float, 2 attributes
        attributes: [ 
          { // positions
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3', // vec3f 
          },
          { // normals
            shaderLocation: 1,
            offset: 4*3,
            format: 'float32x3', // vec3f 
          },
          { // texture coords
            shaderLocation: 2,
            offset: 4*3*2,
            format: 'float32x2', // vec2f 
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

const bindGroup = device.createBindGroup({
  layout: bindGroupLayout,
  entries: [
    {binding: 0, resource: {buffer: vpBuffer}},
    {binding: 1, resource: {buffer: camBuffer}},
  ],
});

const mBuffer = device.createBuffer({
  label: "model matrix buffer",
  size: mData.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(mBuffer, 0, mData);


//const response = await fetch('./Original_Doge_meme.jpg');
const response = await fetch('./pngtree-grey-gravel-texture-wallpaper-png-image_5752418.png');
const imageBitmapTest = await createImageBitmap(await response.blob());
const texBuffer = device.createTexture({
  label: 'tex0',
  size: [imageBitmapTest.width, imageBitmapTest.height, 1],
  format: 'rgba8unorm',
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT,
});
device.queue.copyExternalImageToTexture(
  { source: imageBitmapTest },
  { texture: texBuffer },
  [imageBitmapTest.width, imageBitmapTest.height]
);
const response1 = await fetch('./Atlas_00002.png');
const imageBitmapTest1 = await createImageBitmap(await response1.blob());
const texBuffer1 = device.createTexture({
  label: 'tex1',
  size: [imageBitmapTest1.width, imageBitmapTest1.height, 1],
  format: 'rgba8unorm',
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT,
});
device.queue.copyExternalImageToTexture(
  { source: imageBitmapTest1 },
  { texture: texBuffer1 },
  [imageBitmapTest1.width, imageBitmapTest1.height]
);
const response2 = await fetch('./cu_awp_hyper_beast.jpg');
const imageBitmapTest2 = await createImageBitmap(await response2.blob());
const texBuffer2 = device.createTexture({
  label: 'tex2',
  size: [imageBitmapTest2.width, imageBitmapTest2.height, 1],
  format: 'rgba8unorm',
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT,
});
device.queue.copyExternalImageToTexture(
  { source: imageBitmapTest2 },
  { texture: texBuffer2 },
  [imageBitmapTest2.width, imageBitmapTest2.height]
);
const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear', //want to change to anisotropic if possible
  mipmapFilter : 'linear',
  maxAnisotropy: 16,
});
const bindGroup1 = device.createBindGroup({
  layout: bindGroup1Layout,
  entries: [
    {binding: 0, resource: {buffer: mBuffer}},
    {binding: 1, resource: sampler},
    {binding: 2, resource: texBuffer.createView()},
  ]
});
//// TODO obj testing

// let objectLoader = new ObjLoader();
let currObjFile = '';
let bunny = '';
let room = '';
let awp = '';
let castle = '';
async function load(filePath) {

  const resp = await fetch(filePath)
  if (!resp.ok) {
  throw new Error(
      `ObjLoader could not fine file at ${filePath}. Please check your path.`
  )
  }
  const file = await resp.text()

  if (file.length === 0) {
  throw new Error(`${filePath} File is empty.`)
  }
  return file;
}
async function loadAndParseObject(filePath, obj) {
  try {
    const fileContents = await load(filePath);
    currObjFile = new OBJFile(fileContents);
    obj = currObjFile.parse();
    // const bunnyVert = new Float32Array(bunny.models[0].vertices);
    // bunny.models[0].vertices = bunnyVert;
    // //console.log("bunny.models[0].vertices", bunny.models[0].vertices);
    // const bunnyNorm = new Float32Array(bunny.models[0].vertexNormals);
    // bunny.models[0].vertexNormals = bunnyNorm;
    // const bunnyTexCoord = new Float32Array(bunny.models[0].textureCoords);
    // bunny.models[0].textureCoords = bunnyTexCoord;
    const bunnyIndex = new Uint32Array(obj.models[0].indices);
    obj.models[0].indices = bunnyIndex;
    // const bunnyNormalIndex = new Uint32Array(bunny.models[0].normalIndices);
    // bunny.models[0].normalIndices = bunnyNormalIndex;
    // const bunnyTexIndex = new Uint32Array(bunny.models[0].textureIndices);
    // bunny.models[0].textureIndices = bunnyTexIndex;
    // console.log("texcoords", bunny.models[0].textureCoords);
    return obj;
  } catch (error) {
    console.error('Error loading or parsing object:', error);
  }
}

// async obj load
(async () => {
  bunny = await loadAndParseObject('./bunny_uv.obj', bunny); // TODO look into using this instead: https://github.com/WesUnwin/obj-file-parser/blob/master/src/OBJFile.js
  console.log('Loading and parsing of obj complete.');
  console.log(bunny);
  room = await loadAndParseObject('./test_gallery_cube.obj', room);
  console.log('Loading and parsing of obj complete.');
  console.log(room);
  awp =  await loadAndParseObject('./awp.obj', awp);
  console.log(awp);
  castle =  await loadAndParseObject('Peach_Castle_F1_atlas.obj', castle);
  console.log(castle);

  createRenderable(renderablesArray, bunny, mArray[0], texBuffer);
  createRenderable(renderablesArray, awp, new Float32Array(
    [ Math.cos(Math.PI / 4)*0.2, 0, -Math.sin(Math.PI / 4)*0.2, 0,
      0, 0.2, 0, 0,
      Math.sin(Math.PI / 4)*0.2, 0, Math.cos(Math.PI / 4)*0.2, 0,
      2, 2, 0, 1]
  ), texBuffer2);
  createRenderable(renderablesArray, room, 
    new Float32Array(
    [ 1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 10, 1]), texBuffer1);
  createRenderable(renderablesArray, castle, 
    new Float32Array(
    [ 100, 0, 0, 0,
      0, 100, 0, 0,
      0, 0, 100, 0,
      0, 0, 10, 1]), texBuffer1);
  // createRenderable(renderablesArray, bunny, mArray[3]);
  // createRenderable(renderablesArray, bunny, mArray[4]);
  // createRenderable(renderablesArray, bunny, mArray[5]);
  // createRenderable(renderablesArray, bunny, mArray[6]);
  // createRenderable(renderablesArray, bunny, mArray[7]);
  // createRenderable(renderablesArray, bunny, mArray[8]);
  // createRenderable(renderablesArray, bunny, mArray[9]);
  // createRenderable(renderablesArray, bunny, mArray[10]);
  // createRenderable(renderablesArray, bunny, mArray[11]);
  // createRenderable(renderablesArray, bunny, mArray[12]);
  // createRenderable(renderablesArray, bunny, mArray[13]);
  // createRenderable(renderablesArray, bunny, mArray[14]);

})();

function createRenderable(arr, modelInfo, transformMat, texture) { //arr is the renderablesArray
  let modelVertNorm = new Float32Array(modelInfo.models[0].indices.byteLength/4*8); //hardcoded for now, basically just indicies * num elements per vertex buffer array index
  combineVertNormalArr(modelInfo.models[0].vertices, modelInfo.models[0].vertexNormals, modelInfo.models[0].textureCoords, modelInfo.models[0].indices, modelInfo.models[0].normalIndices, modelInfo.models[0].textureIndices, modelVertNorm);

  const i = arr.push(new Renderable()) - 1;// new model, push returns size of array. Stored in i for later access
  arr[i].vertNorm = device.createBuffer({ // see if can keep it const TODO
    label: "vertex data buffer",
    size: modelVertNorm.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(arr[i].vertNorm, 0, modelVertNorm);
  // arr[i].indices = device.createBuffer({ // see if can keep it const TODO
  //   label: "vertex index buffer",
  //   size: modelInfo.models[0].indices.byteLength,
  //   usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  // });
  // device.queue.writeBuffer(arr[i].indices, 0, modelInfo.models[0].indices);
  arr[i].indices = [];
  arr[i].numDrawCalls = modelInfo.models[0].indices.byteLength/4; 
  console.log("numDrawCalls: ", arr[i].numDrawCalls);
  arr[i].transform = transformMat;

  const mBuffer1 = device.createBuffer({
    label: "model matrix buffer",
    size: arr[i].transform.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(mBuffer1, 0, arr[i].transform)

  // need to load texture here, not sure how with async being weird
  arr[i].bindGroup = device.createBindGroup({
    layout: bindGroup1Layout,
    entries: [
      {binding: 0, resource: {buffer: mBuffer1}},
      {binding: 1, resource: sampler}, // these are the ones defined outside of this func for now
      {binding: 2, resource: texture.createView()}, // these are the ones defined outside of this func for now
    ]
  });
}

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
    // console.log(camera);
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
  //joystick
  console.log("joy: ", joy.GetX(), joy.GetY());
  if (joy.GetY() > 30) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], forwardVector, forwardVector);
    vec3.add(forwardVector, cameraPos, cameraPos);
  } else if (joy.GetY() < -30) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], forwardVector, forwardVector);
    vec3.subtract(cameraPos, forwardVector, cameraPos);
  }  
  if (joy.GetX() > 30) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], rightVector, rightVector);
    vec3.add(vec3.negate(rightVector), cameraPos, cameraPos);
  } else if (joy.GetX() < -30) {
    vec3.multiply([moveSpeed*deltaTime, moveSpeed*deltaTime, moveSpeed*deltaTime], rightVector, rightVector);
    vec3.add(rightVector, cameraPos, cameraPos);
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
  passEncoder.setBindGroup(0, bindGroup);

  for (const renderable of renderablesArray) {
    passEncoder.setVertexBuffer(0, renderable.vertNorm);
    //passEncoder.setIndexBuffer(renderable.indices, "uint16");
    passEncoder.setBindGroup(1, renderable.bindGroup);
    //passEncoder.drawIndexed(renderable.numDrawCalls); 
    passEncoder.draw(renderable.numDrawCalls); //normals might still be wrong, draw calls equals faces count * 3
  }
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
