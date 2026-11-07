import {buildPanel,exportValidated} from './mesh.js';
const $=id=>document.getElementById(id),form=$('settings'),status=$('status'),button=$('export'),canvas=$('preview');
let bitmap=null,loading=0;
function dimensions(){const width=Number($('width').value);return {width,height:bitmap?width*bitmap.height/bitmap.width:0};}
function update(){if(bitmap){const d=dimensions();$('dimensions').textContent=`${d.width.toFixed(1)} × ${d.height.toFixed(1)} mm`;button.disabled=false;}status.textContent=bitmap?'Ready. Export runs geometry and STL read-back checks.':'Choose an image to get started.';}
$('file').addEventListener('change',async()=>{
  const token=++loading,file=$('file').files[0];button.disabled=true;
  bitmap?.close();bitmap=null;canvas.hidden=true;$('empty').hidden=false;
  if(!file){update();return;}
  try {
    if(file.size>40*1024*1024) throw new Error('Please choose an image smaller than 40 MB.');
    const decoded=await createImageBitmap(file,{imageOrientation:'from-image'});
    if(token!==loading){decoded.close();return;}
    if(decoded.width*decoded.height>80_000_000){decoded.close();throw new Error('Please choose an image below 80 megapixels.');}
    bitmap=decoded;const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    canvas.hidden=false;$('empty').hidden=true;update();
  }catch(error){if(token===loading) status.textContent=`Image could not be opened: ${error.message}`;}
});
form.addEventListener('input',e=>{if(e.target.id!=='file')update();});
form.addEventListener('submit',async e=>{
  e.preventDefault();if(!bitmap)return;button.disabled=true;status.textContent='Building and checking both the mesh and exported STL…';
  await new Promise(resolve=>setTimeout(resolve,30));
  try {
    const {width,height}=dimensions(),detail=Number($('detail').value),ratio=bitmap.width/bitmap.height;
    const columns=Math.max(2,Math.round(detail*Math.min(1,ratio))),rows=Math.max(2,Math.round(detail*Math.min(1,1/ratio)));
    const sample=document.createElement('canvas');sample.width=columns;sample.height=rows;
    const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,columns,rows);ctx.drawImage(bitmap,0,0,columns,rows);
    const pixels=ctx.getImageData(0,0,columns,rows).data,brightness=new Float32Array(columns*rows);
    // Canvas row 0 is the top of the image; model row 0 is the bottom (+Y up).
    for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {const p=((rows-1-y)*columns+x)*4;brightness[y*columns+x]=(0.2126*pixels[p]+0.7152*pixels[p+1]+0.0722*pixels[p+2])/255;}
    const mesh=buildPanel({width,height,columns,rows,brightness,minThickness:Number($('min').value),maxThickness:Number($('max').value)});
    const result=exportValidated(mesh),r=result.exported;
    const blob=new Blob([result.buffer],{type:'model/stl'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`lithophane-${width}mm.stl`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    status.textContent=`✓ Mesh and STL read-back passed\n${r.triangles.toLocaleString()} triangles · one closed solid\nThickness ${r.minimumThickness.toFixed(3)}–${r.maximumThickness.toFixed(3)} mm · ${(result.buffer.byteLength/1048576).toFixed(1)} MB\nSampling: ${(width/(columns-1)).toFixed(2)} × ${(height/(rows-1)).toFixed(2)} mm. Inspect the slicer preview before printing.`;
  }catch(error){status.textContent=`Export blocked: ${error.message}`;}
  finally{button.disabled=!bitmap;}
});
