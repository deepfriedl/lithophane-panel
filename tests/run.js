import {buildPanel,validateMesh,certifyPanel,exportValidated,readSTL,writeSTL} from '../mesh.js';
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const rejects=(fn)=>{let threw=false;try{fn();}catch{threw=true;}check(threw,'Invalid geometry was accepted');};
const base={width:100,height:75,columns:5,rows:4,minThickness:.8,maxThickness:3.2};
const make=(options={},pattern=i=>i%2)=>{const s={...base,...options};return buildPanel({...s,brightness:Float32Array.from({length:s.columns*s.rows},(_,i)=>pattern(i))});};
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
test('black, white, gradient, checkerboard round trips',()=>{
 for(const pattern of [()=>0,()=>1,i=>i/19,i=>i%2]){const m=make({},pattern),r=exportValidated(m);check(r.exported.vertices===40,'Welding lost vertices');check(r.internal.volume===r.exported.volume,'Volume changed');}
});
test('uniform panel has analytic volume and maintained minimum',()=>{const r=exportValidated(make({},()=>1)).exported;check(Math.abs(r.volume-100*75*.8)<.001,'Volume mismatch');check(r.minimumThickness>=.8,'Minimum lost to float32 rounding');});
test('equal min and max supported',()=>exportValidated(make({minThickness:1,maxThickness:1})));
test('minimum grid and thin/wide/tall extremes',()=>{for(const options of [{columns:2,rows:2},{width:10,height:2000},{width:400,height:1,minThickness:.4,maxThickness:12}])exportValidated(make(options));});
test('seeded random panels',()=>{let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<20;i++)exportValidated(make({columns:2+i,rows:3+i},random));});
test('fine 256 × 256 mesh round trip',()=>exportValidated(make({columns:256,rows:256},i=>(i%256)/255)));
test('missing face is blocked internally and after STL welding',()=>{const m=make();m.triangles=m.triangles.slice(3);rejects(()=>validateMesh(m));rejects(()=>validateMesh(readSTL(writeSTL(m))));});
test('reversed face is blocked after STL welding',()=>{const m=make();[m.triangles[0],m.triangles[1]]=[m.triangles[1],m.triangles[0]];rejects(()=>validateMesh(readSTL(writeSTL(m))));});
test('entire inside-out solid is blocked',()=>{const m=make();for(let i=0;i<m.triangles.length;i+=3)[m.triangles[i],m.triangles[i+1]]=[m.triangles[i+1],m.triangles[i]];rejects(()=>validateMesh(m));});
test('duplicate, degenerate and disconnected meshes are blocked',()=>{
 const m=make();rejects(()=>validateMesh({...m,triangles:new Uint32Array([...m.triangles,...m.triangles.slice(0,3)])}));
 const d=make();d.triangles[1]=d.triangles[0];rejects(()=>validateMesh(d));
 const v=new Float32Array([...m.vertices,...m.vertices.map((x,i)=>i%3===0?x+200:x)]),n=m.vertices.length/3;
 rejects(()=>validateMesh({vertices:v,triangles:new Uint32Array([...m.triangles,...m.triangles.map(i=>i+n)])}));
});
test('crossed grid, changed flat back, and subminimum height blocked',()=>{for(const change of [m=>m.vertices[0]=200,m=>m.vertices[base.columns*base.rows*3+2]=.1,m=>m.vertices[2]=.2]){const m=make();change(m);rejects(()=>certifyPanel(m));}});
test('STL coordinate corruption blocked by panel certificate',()=>{const m=make(),buffer=writeSTL(m);new DataView(buffer).setFloat32(96,101,true);rejects(()=>certifyPanel(readSTL(buffer),m));});
test('truncated and malformed STL blocked',()=>{const buffer=writeSTL(make());rejects(()=>readSTL(buffer.slice(0,-1)));rejects(()=>readSTL(new ArrayBuffer(20)));new DataView(buffer).setFloat32(96,NaN,true);rejects(()=>readSTL(buffer));});
test('invalid parameters blocked',()=>{for(const o of [{width:NaN},{minThickness:0},{maxThickness:.1},{height:0},{columns:1},{rows:257}])rejects(()=>make(o));rejects(()=>make({},()=>NaN));});
let passed=0;for(const [name,fn] of tests){const start=Date.now();await fn();console.log(`PASS ${name} (${Date.now()-start} ms)`);passed++;}console.log(`${passed}/${tests.length} test groups passed`);
