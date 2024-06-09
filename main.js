import vertWGSL from './vert.js';
import fragWGSL from './frag.js';
import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.min.js'; // TODO, try to import this from node


// TODO: put things in clip space in the shader so that I can see things instead of with world space, (standard mvp matrix stuff)
// camera with lookat point will probably be easiest

const canvas = document.querySelector('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext('webgpu');

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

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

var lookAtPoint = new Float32Array([
  0, 0, 0,
]);

// TODO could try mat4.lookAT();
const camera = mat4.lookAt( //makes a view matrix
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
const vp = mat4.multiply(perspective, camera);
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
