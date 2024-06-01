let vertex_wgsl = `
@vertex
fn main(
  @location(0) inPosition: vec4f,
  @builtin(vertex_index) VertexIndex: u32
) -> @builtin(position) vec4f {
  return inPosition;
}
`;
export default vertex_wgsl;
