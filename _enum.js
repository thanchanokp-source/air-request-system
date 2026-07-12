const ExcelJS=require("exceljs");
(async()=>{
  for(const bu of ["NYG","GW"]){
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.readFile("public/air-request-template_"+bu+".xlsx");
    const ws=wb.worksheets[0];
    const hdr={}; ws.getRow(1).eachCell({includeEmpty:true},(c,n)=>hdr[n]=c.value);
    console.log("=== "+bu+" === sheets:",wb.worksheets.map(w=>w.name).join(" | "));
    for(let col=1;col<=31;col++){
      const L=ws.getColumn(col).letter;
      const dv=ws.getCell(L+"2").dataValidation;
      if(dv) console.log("  col",col,L,"("+hdr[col]+") ->",JSON.stringify(dv.formulae));
    }
  }
})().catch(e=>console.log("ERR",e.message));
