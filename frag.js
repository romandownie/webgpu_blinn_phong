let frag_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 
@group(0) @binding(1) var<uniform> cameraPos: vec3f; 
//@group(0) @binding(2) var<uniform> normalArray: array<vec3f>;
@group(1) @binding(0) var<uniform> m: mat4x4f; 
@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;


@fragment
fn main(@location(0) fragPos: vec4<f32>, @location(1) norm: vec3<f32>, @location(2) UV: vec2<f32>) -> @location(0) vec4f {
  let texAlbedo = textureSample(myTexture, mySampler, UV);
  let testLight = vec4f(0.0, 5.0, 5.0, 1.0);

  let normal = norm; //normal hard coded as straight up right now

  //blinn phong lighting model, reference: https://learnopengl.com/Advanced-Lighting/Advanced-Lighting
  let lightDirVec = testLight.xyz - fragPos.xyz;
  let lightDirN = normalize(lightDirVec);
  let viewDir = normalize(cameraPos.xyz - fragPos.xyz);
  let halfwayDir = normalize(lightDirN + viewDir);

  let distanceSqr = pow(length(lightDirVec), 2.0);
  let intensity = max(dot(normal, lightDirN), 0.0);
  //let diffuse = vec3f(0.9, 0.1, 0.1) * intensity * (20/distanceSqr);
  let diffuse = texAlbedo.xyz * intensity * (20/distanceSqr);

  // specular might have to fall off with distance
  let spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0); // 32.0 is shininess here
  let specular = vec3f(1.0,1.0,1.0) * spec; //hardcoded white

  //let ambient = vec4f(vec3f(0.2, 0.02, 0.02), 1.0); 
  let ambient = vec4f(texAlbedo.xyz * 0.2, 1.0); 

  
  //let finalColor = vec4f(specular, 1.0); // just specular for testing
  //let finalColor = vec4f(diffuse, 1.0); // just diffuse for testing
  //let finalColor = ambient; // just ambient for testing
  // let finalColor = vec4f(diffuse, 1.0) + vec4f(specular, 1.0) + ambient; // diffuse + specular + ambient
  let finalColor = vec4f(diffuse, 1.0) + vec4f(specular, 1.0) + ambient; // diffuse + specular + ambient

  return finalColor;
  //return textureSample(myTexture, mySampler, UV); //testing texture
  //return vec4f(1.0, 0.0, 0.0, 1.0); // testing color
}
`;
export default frag_wgsl;