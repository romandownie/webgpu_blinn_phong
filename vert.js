let vertex_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragPos: vec4f,
}

@vertex
fn main(
  @location(0) inPosition: vec4f,
  @builtin(vertex_index) VertexIndex: u32
) -> VertexOutput {
  var output : VertexOutput;
  output.Position = vp * inPosition;
  output.fragPos = inPosition;
  return output;
}
`;
export default vertex_wgsl;
