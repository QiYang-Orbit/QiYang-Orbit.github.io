import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export type ReportData = { employee: string; date: string; rows: { date: string; start: string; end: string }[] };
const hours = (a: string,b: string) => {const [h,m]=a.split(':').map(Number),[j,n]=b.split(':').map(Number);return Math.max(0,(j*60+n-h*60-m)/60)};
const label = (n:number) => Number(n.toFixed(2)).toString();
const dateLabel = (d:string) => {const [y,m,k]=d.split('-');return `${m}/${k}/${y}`};
const timeLabel = (s:string) => {const [h,m]=s.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
const escapeXml = (s:string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function reportBlocks(data:ReportData) {
 const weeks = new Map<string, ReportData['rows']>();
 for(const row of [...data.rows].sort((a,b)=>a.date.localeCompare(b.date))) {
  const d=new Date(row.date+'T12:00:00'); d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
  const key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if(!weeks.has(key))weeks.set(key,[]);weeks.get(key)!.push(row);
 }
 const blocks:{rows:string[][];total:string;caption:string}[]=[];
 for(const rows of weeks.values()) for(let i=0;i<rows.length;i+=5){
  const last=i+5>=rows.length;
  blocks.push({rows:rows.slice(i,i+5).map(r=>[dateLabel(r.date),timeLabel(r.start),timeLabel(r.end),label(hours(r.start,r.end))]),total:label((last?rows:rows.slice(i,i+5)).reduce((n,r)=>n+hours(r.start,r.end),0)),caption:last?'Weekly Total:':'Subtotal:'});
 }
 return {blocks,total:label(data.rows.reduce((n,r)=>n+hours(r.start,r.end),0))};
}
export async function makeWord(template:ArrayBuffer|Uint8Array,data:ReportData){
 const zip=await JSZip.loadAsync(template);const xml=await zip.file('word/document.xml')!.async('string');
 const {blocks,total}=reportBlocks(data);
 const body=xml.match(/<w:body>([\s\S]*)<\/w:body>/)![1];
 const section=body.match(/<w:sectPr[\s\S]*<\/w:sectPr>/)![0];
 const content=body.replace(section,'');const pages=[];
 for(let page=0;page<Math.max(1,Math.ceil(blocks.length/3));page++){
  const values:Record<string,string>={EMPLOYEE:data.employee,TOTAL:total,DATE:dateLabel(data.date)};
  for(let b=0;b<3;b++){
   const block=blocks[page*3+b];values[`W${b}`]=block?.total||'';values[`L${b}`]=block?.caption||'Weekly Total:';
   for(let r=0;r<5;r++)for(let c=0;c<4;c++)values[`C${b}_${r}_${c}`]=block?.rows[r]?.[c]||'';
  }
  pages.push(content.replace(/\{\{([^}]+)\}\}/g,(_,k)=>escapeXml(values[k]||'')));
 }
 zip.file('word/document.xml',xml.replace(/<w:body>[\s\S]*<\/w:body>/,`<w:body>${pages.join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')}${section}</w:body>`));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function makePdf(template:ArrayBuffer|Uint8Array,data:ReportData){
 const pdf=await PDFDocument.create();const source=await PDFDocument.load(template);const {blocks,total}=reportBlocks(data);
 const serif=await pdf.embedFont(StandardFonts.TimesRoman),sans=await pdf.embedFont(StandardFonts.Helvetica);
 for(let index=0;index<Math.max(1,Math.ceil(blocks.length/3));index++){
  const [page]=await pdf.copyPages(source,[0]);pdf.addPage(page);
  const draw=async(text:string,x:number,top:number,size=12,maxWidth=300,font=serif)=>{
   if(!text)return;
   try {const w=font.widthOfTextAtSize(text,size); page.drawText(text,{x,y:792-top,size:Math.min(size,size*maxWidth/Math.max(w,1)),font});}
   catch {
    // Browser-rendered name fallback supports characters outside the standard PDF fonts.
    const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d')!;ctx.font='48px serif';canvas.width=Math.ceil(ctx.measureText(text).width)+8;canvas.height=64;
    ctx.font='48px serif';ctx.fillStyle='#000';ctx.fillText(text,0,48);
    const image=await pdf.embedPng(canvas.toDataURL('image/png'));const scale=Math.min(size/48,maxWidth/canvas.width);page.drawImage(image,{x,y:792-top-16*scale,width:canvas.width*scale,height:64*scale});
   }
  };
  await draw(data.employee,197.95,113.4,12,325);await draw(total,207.6,139.2);
  await draw(data.employee,228.1,711.2,12,160);await draw(dateLabel(data.date),437,711.2,12,95);
  const rowTops=[[185.2,205.3,225.9,246.5,266.1],[357,377.1,397.7,417.4,438],[542.2,563.2,583.8,603.4,623]];
  for(let b=0;b<3;b++){
   const block=blocks[index*3+b];if(!block)continue;
   for(let r=0;r<block.rows.length;r++)for(let c=0;c<4;c++)await draw(block.rows[r][c],[84.65,196.8,308.6,420.35][c],rowTops[b][r]+10.3,10.5,108,sans);
   if(block.caption==='Subtotal:'){
    page.drawRectangle({x:389,y:792-[313.44,485.04,670.54][b],width:85,height:16,color:rgb(1,1,1)});
    await draw('Subtotal:',390,[311,482.6,668.1][b]);
   }
   await draw(block.total,486,[311,482.6,668.1][b],12,43);
  }
 }
 pdf.setTitle('Prospect Equities Timesheet-Absence Report');pdf.setAuthor(data.employee);pdf.setCreator('Prospect Equities Timesheet');pdf.setProducer('Prospect Equities Timesheet');
 return pdf.save();
}
