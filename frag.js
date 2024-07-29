let frag_wgsl = `
@group(0) @binding(0) var<uniform> vp: mat4x4f; 
@group(0) @binding(1) var<uniform> cameraPos: vec3f; 
//@group(0) @binding(2) var<uniform> normalArray: array<vec3f>;
@group(1) @binding(0) var<uniform> m: mat4x4f; 
@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;
@group(2) @binding(0) var<uniform> lightPos: array<vec4f, 3>; //hardcoded for now, in for loop as well
//@group(2) @binding(1) var<uniform> numLights: i32;


@fragment
fn main(@location(0) fragPos: vec4<f32>, @location(1) norm: vec3<f32>, @location(2) UV: vec2<f32>) -> @location(0) vec4f {
  let brightness = 1750.0; //hardcoded for now
  var finalColor = vec4f(0.0);
  for (var i = 0; i < 3; i++) {
    let texAlbedo = textureSample(myTexture, mySampler, UV);
    // let testLight = vec4f(-150.0, 50.0, 20.0, 1.0);
    let testLight = lightPos[i];

    let normal = norm; //normal hard coded as straight up right now

    //blinn phong lighting model, reference: https://learnopengl.com/Advanced-Lighting/Advanced-Lighting
    let lightDirVec = testLight.xyz - fragPos.xyz;
    let lightDirN = normalize(lightDirVec);
    let viewDir = normalize(cameraPos.xyz - fragPos.xyz);
    let halfwayDir = normalize(lightDirN + viewDir);

    let distanceSqr = pow(length(lightDirVec), 2.0);
    let intensity = max(dot(normal, lightDirN), 0.0);
    //let diffuse = vec3f(0.9, 0.1, 0.1) * intensity * (brightness/distanceSqr);
    let diffuse = texAlbedo.xyz * intensity * (brightness/distanceSqr);

    // specular might have to fall off with distance
    let spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0); // 32.0 is shininess here
    let specular = vec3f(1.0,1.0,1.0) * (brightness/distanceSqr) * spec; //hardcoded white

    //let ambient = vec4f(vec3f(0.2, 0.02, 0.02), 1.0); 
    let ambient = vec4f(texAlbedo.xyz * 0.2 * 1/3, 1.0); // 1/3 is numLights here 

    
    //let finalColor = vec4f(specular, 1.0); // just specular for testing
    //let finalColor = vec4f(diffuse, 1.0); // just diffuse for testing
    //let finalColor = ambient; // just ambient for testing
    // let finalColor = vec4f(diffuse, 1.0) + vec4f(specular, 1.0) + ambient; // diffuse + specular + ambient
    finalColor += vec4f(diffuse, 1.0) + vec4f(specular, 1.0) + ambient; // diffuse + specular + ambient
  }
  return finalColor;
  //return textureSample(myTexture, mySampler, UV); //testing texture
  //return vec4f(1.0, 0.0, 0.0, 1.0); // testing color
}
`;
export default frag_wgsl;

// before messing with the lights:

/*
@fragment
fn main(@location(0) fragPos: vec4<f32>, @location(1) norm: vec3<f32>, @location(2) UV: vec2<f32>) -> @location(0) vec4f {
  let texAlbedo = textureSample(myTexture, mySampler, UV);
  // let testLight = vec4f(-150.0, 50.0, 20.0, 1.0);
  let testLight = lightPos;

  let normal = norm; //normal hard coded as straight up right now

  //blinn phong lighting model, reference: https://learnopengl.com/Advanced-Lighting/Advanced-Lighting
  let lightDirVec = testLight.xyz - fragPos.xyz;
  let lightDirN = normalize(lightDirVec);
  let viewDir = normalize(cameraPos.xyz - fragPos.xyz);
  let halfwayDir = normalize(lightDirN + viewDir);

  let distanceSqr = pow(length(lightDirVec), 2.0);
  let intensity = max(dot(normal, lightDirN), 0.0);
  //let diffuse = vec3f(0.9, 0.1, 0.1) * intensity * (2000/distanceSqr);
  let diffuse = texAlbedo.xyz * intensity * (2000/distanceSqr);

  // specular might have to fall off with distance
  let spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0); // 32.0 is shininess here
  let specular = vec3f(1.0,1.0,1.0) * (2000/distanceSqr) * spec; //hardcoded white

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
*/