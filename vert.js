let vertex_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragPos: vec4f,
  @location(1) norm: vec3f,
}

@vertex
fn main(
  @location(0) inPosition: vec4f,
  @location(1) inNormal: vec3f,
  @builtin(vertex_index) VertexIndex: u32
) -> VertexOutput {
  var output : VertexOutput;
  let scale = mat4x4f(4.0, 0.0, 0.0, 0.0,
                      0.0, 4.0, 0.0, 0.0,
                      0.0, 0.0, 4.0, 0.0,
                      0.0, 0.0, 0.0, 1.0);
  output.Position = vp * scale * inPosition;
  output.fragPos = inPosition;
  output.norm = inNormal;
  return output;
}
`;
export default vertex_wgsl;
