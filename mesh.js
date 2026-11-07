/* Flat height-field solids. Coordinates: X right, Y up, Z toward viewer. */
export const LIMITS = {width:[10,400], min:[0.4,8], max:[0.4,12], samples:[8,256]};
const assert = (ok, message) => { if (!ok) throw new Error(message); };
function up32(x) {
  const f = new Float32Array([x]);
  if (f[0] < x) { const u = new Uint32Array(f.buffer); u[0]++; }
  return f[0];
}
export function buildPanel({width,height,columns,rows,brightness,minThickness,maxThickness}) {
  assert(Number.isFinite(width)&&width>=10&&width<=400, 'Width must be 10–400 mm.');
  assert(Number.isFinite(height)&&height>=1&&height<=2000, 'Image aspect ratio gives an unsupported height (1–2000 mm).');
  assert(Number.isInteger(columns)&&Number.isInteger(rows)&&columns>=2&&rows>=2&&columns<=256&&rows<=256, 'Invalid sample grid.');
  assert(minThickness>=0.4&&minThickness<=8&&maxThickness<=12&&maxThickness>=minThickness&&Number.isFinite(maxThickness), 'Thickness must satisfy 0.4 ≤ minimum ≤ maximum ≤ 12 mm.');
  assert(brightness.length===columns*rows, 'Incorrect image sample count.');
  const n=columns*rows, vertices=new Float32Array(n*6), triangles=[];
  for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
    const i=y*columns+x, b=brightness[i];
    assert(Number.isFinite(b)&&b>=0&&b<=1,'Invalid brightness sample.');
    const px=Math.fround(x*width/(columns-1)), py=Math.fround(y*height/(rows-1));
    vertices.set([px,py,up32(minThickness+(1-b)*(maxThickness-minThickness))],i*3);
    vertices.set([px,py,0],(i+n)*3);
  }
  for(let y=0;y<rows-1;y++) for(let x=0;x<columns-1;x++) {
    const a=y*columns+x,b=a+1,c=a+columns,d=c+1;
    triangles.push(a,b,d,a,d,c, a+n,d+n,b+n,a+n,c+n,d+n);
  }
  // CCW perimeter seen from relief side; walls face away from the interior.
  const rim=[];
  for(let x=0;x<columns;x++) rim.push(x);
  for(let y=1;y<rows;y++) rim.push(y*columns+columns-1);
  for(let x=columns-2;x>=0;x--) rim.push((rows-1)*columns+x);
  for(let y=rows-2;y>0;y--) rim.push(y*columns);
  for(let j=0;j<rim.length;j++) {
    const a=rim[j],b=rim[(j+1)%rim.length];
    triangles.push(a,a+n,b+n,a,b+n,b);
  }
  return {vertices,triangles:new Uint32Array(triangles),spec:{width,height,columns,rows,minThickness,maxThickness}};
}
export function validateMesh(mesh) {
  const {vertices:v,triangles:t}=mesh;
  assert(v.length%3===0&&t.length%3===0&&t.length>0,'Invalid mesh buffers.');
  const edges=new Map(), used=new Set(), faces=new Set(), neighbors=Array.from({length:v.length/3},()=>[]);
  let volume6=0;
  for(let k=0;k<v.length;k++) assert(Number.isFinite(v[k]),'Non-finite coordinate.');
  const positions=new Set();
  for(let k=0;k<v.length;k+=3) {const key=`${v[k]},${v[k+1]},${v[k+2]}`;assert(!positions.has(key),'Duplicate vertex position.');positions.add(key);}
  for(let k=0;k<t.length;k+=3) {
    const ids=[t[k],t[k+1],t[k+2]];
    assert(ids.every(i=>i<v.length/3),'Vertex index out of range.');
    const fk=[...ids].sort((a,b)=>a-b).join(',');assert(!faces.has(fk),'Duplicate triangle.');faces.add(fk);
    const [a,b,c]=ids.map(i=>[v[i*3],v[i*3+1],v[i*3+2]]);
    const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
    const cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    assert(cross.some(x=>x!==0),'Degenerate triangle.');
    volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    for(let j=0;j<3;j++) {
      const p=ids[j],q=ids[(j+1)%3],key=p<q?`${p},${q}`:`${q},${p}`;
      const e=edges.get(key)||{count:0,balance:0};e.count++;e.balance+=p<q?1:-1;edges.set(key,e);
      used.add(p);neighbors[p].push(q);neighbors[q].push(p);
    }
  }
  for(const e of edges.values()) assert(e.count===2&&e.balance===0,'Open, non-manifold, or inconsistently wound edge.');
  assert(used.size===v.length/3,'Unused vertices.');
  const reached=new Set([t[0]]), stack=[t[0]];
  while(stack.length) for(const q of neighbors[stack.pop()]) if(!reached.has(q)){reached.add(q);stack.push(q);}
  assert(reached.size===used.size,'Disconnected solid.');
  assert(used.size-edges.size+t.length/3===2,'Unexpected topology.');
  assert(volume6>0,'Solid is not outward-facing.');
  return {vertices:used.size,triangles:t.length/3,edges:edges.size,volume:volume6/6};
}
function faceKey(a,b,c) {return [a,b,c].sort().join('|');}
// Exact structural certificate, specialized to flat panels, not a general mesh repair tool.
// Every cell has two nonoverlapping projected triangles on each surface. Positive
// height separates front/back; the perimeter walls occupy the rectangle boundary.
// Matching the entire expected oriented triangulation proves no self-intersections.
export function certifyPanel(mesh, reference=mesh) {
  const {spec:s}=reference;
  assert(s,'Missing panel specification.');
  const {columns:c,rows:r}=s, n=c*r, v=reference.vertices;
  assert(v.length===n*6,'Invalid panel vertex count.');
  let minimum=Infinity, maximum=0;
  for(let y=0;y<r;y++) for(let x=0;x<c;x++) {
    const i=y*c+x, p=i*3, b=(i+n)*3;
    assert(v[p]===Math.fround(x*s.width/(c-1))&&v[p+1]===Math.fround(y*s.height/(r-1)), 'Invalid height-field grid.');
    assert(v[b]===v[p]&&v[b+1]===v[p+1]&&v[b+2]===0,'Back must be flat.');
    assert(v[p+2]>=s.minThickness&&v[p+2]<=up32(s.maxThickness),'Thickness outside bounds.');
    minimum=Math.min(minimum,v[p+2]);maximum=Math.max(maximum,v[p+2]);
  }
  const expected=buildPanel({...s,brightness:new Float32Array(n)});
  assert(reference.triangles.length===expected.triangles.length,'Unexpected face count.');
  for(let i=0;i<expected.triangles.length;i++) assert(reference.triangles[i]===expected.triangles[i],'Unexpected panel triangulation.');
  const keyAt=(vertices,i)=>`${vertices[i*3]},${vertices[i*3+1]},${vertices[i*3+2]}`;
  const expectedFaces=new Set();
  for(let i=0;i<reference.triangles.length;i+=3) expectedFaces.add(faceKey(...Array.from(reference.triangles.slice(i,i+3),id=>keyAt(v,id))));
  assert(mesh.triangles.length===reference.triangles.length&&mesh.vertices.length===v.length,'STL geometry count changed.');
  for(let i=0;i<mesh.triangles.length;i+=3) {
    const key=faceKey(...Array.from(mesh.triangles.slice(i,i+3),id=>keyAt(mesh.vertices,id)));
    assert(expectedFaces.delete(key),'Unexpected or duplicated panel face.');
  }
  assert(expectedFaces.size===0,'Missing panel faces.');
  return {minimumThickness:minimum,maximumThickness:maximum,selfIntersections:0};
}
export function writeSTL(mesh) {
  const {vertices:v,triangles:t}=mesh,count=t.length/3,buffer=new ArrayBuffer(84+count*50),d=new DataView(buffer);
  new Uint8Array(buffer).set(new TextEncoder().encode('lithophane-panel | millimeters | relief +Z'));
  d.setUint32(80,count,true);
  for(let f=0;f<count;f++) {
    const off=84+f*50, p=Array.from(t.slice(f*3,f*3+3),i=>Array.from(v.slice(i*3,i*3+3)));
    const u=p[1].map((x,i)=>x-p[0][i]),w=p[2].map((x,i)=>x-p[0][i]);
    const normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...normal);
    normal.forEach((x,i)=>d.setFloat32(off+i*4,x/len,true));
    p.flat().forEach((x,i)=>d.setFloat32(off+12+i*4,x,true));
  }
  return buffer;
}
export function readSTL(buffer) {
  assert(buffer.byteLength>=84,'Truncated STL.');
  const d=new DataView(buffer),count=d.getUint32(80,true);
  assert(buffer.byteLength===84+count*50,'Incorrect STL length.');
  const vertices=[],triangles=[],indices=new Map();
  for(let f=0;f<count;f++) for(let p=0;p<3;p++) {
    const off=84+f*50+12+p*12,xyz=[0,4,8].map(x=>d.getFloat32(off+x,true));
    assert(xyz.every(Number.isFinite),'Invalid STL coordinate.');
    const key=xyz.join(',');
    if(!indices.has(key)){indices.set(key,vertices.length/3);vertices.push(...xyz);}
    triangles.push(indices.get(key));
  }
  return {vertices:new Float32Array(vertices),triangles:new Uint32Array(triangles)};
}
export function exportValidated(mesh) {
  const internal={...validateMesh(mesh),...certifyPanel(mesh)};
  const buffer=writeSTL(mesh),readback=readSTL(buffer);
  const exported={...validateMesh(readback),...certifyPanel(readback,mesh)};
  return {buffer,internal,exported};
}
