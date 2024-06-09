let vertex_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 

@vertex
fn main(
  @location(0) inPosition: vec4f,
  @builtin(vertex_index) VertexIndex: u32
) -> @builtin(position) vec4f {
  let test = vp;
  return vp * inPosition;
}
`;
export default vertex_wgsl;
