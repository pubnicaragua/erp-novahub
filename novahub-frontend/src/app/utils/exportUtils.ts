export const exportToCsv = (filename: string, rows: any[][]) => {
  const processRow = (row: any[]) => {
    return row.map(val => {
      let finalVal = val === null || val === undefined ? '' : 
        (val instanceof Date ? val.toLocaleDateString() : String(val));

      let result = finalVal.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = `"${result}"`;
      }
      return result;
    }).join(',');
  };

  const csvFile = rows.map(processRow).join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvFile], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel formatting
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
