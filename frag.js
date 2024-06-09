let frag_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 



@fragment
fn main(@location(0) fragPos: vec4<f32>) -> @location(0) vec4f {

  let testLight = vec4f(0.0, 5.0, 5.0, 1.0);
  let testCameraPos = vec4f(0.0, 20.0, -20.0, 1.0);

  let normal = normalize(vec3f(0.0, 1.0, 0.0)); //normal hard coded as straight up right now

  //blinn phong lighting model, reference: https://learnopengl.com/Advanced-Lighting/Advanced-Lighting
  let lightDirVec = testLight.xyz - fragPos.xyz;
  let lightDirN = normalize(lightDirVec);
  let viewDir = normalize(testCameraPos.xyz - fragPos.xyz);
  let halfwayDir = normalize(lightDirN + viewDir);

  let distanceSqr = pow(length(lightDirVec), 2.0);
  let intensity = max(dot(normal, lightDirN), 0.0);
  let diffuse = vec3f(0.9, 0.1, 0.1) * intensity * (20/distanceSqr);

  let spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0); // 32.0 is shininess here
  let specular = vec3f(1.0,1.0,1.0) * spec; //hardcoded white

  let ambient = vec4f(0.3, 0.03, 0.03, 1.0);

  
  //let finalColor = vec4f(specular, 1.0); // just specular for testing
  //let finalColor = vec4f(diffuse, 1.0); // just diffuse for testing
  //let finalColor = ambient; // just ambient for testing
  let finalColor = vec4f(diffuse, 1.0) + vec4f(specular, 1.0) + ambient; // diffuse + specular + ambient

  return finalColor;
}
`;
export default frag_wgsl;