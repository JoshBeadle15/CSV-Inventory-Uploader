#!/usr/bin/env node

/**
 * Quick script to read the sample AIMSii XLSX file
 */

import ExcelJS from 'exceljs';

const filePath = '/Users/ninja/Downloads/InventoryCountbyCategoryFEED.xlsx';

async function readExcelFile() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];

    console.log('=== SPREADSHEET DATA ===\n');
    console.log(`Sheet Name: ${worksheet.name}`);
    console.log(`Row Count: ${worksheet.rowCount}`);
    console.log(`Column Count: ${worksheet.columnCount}\n`);

    // Get headers (first row)
    const headers = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers.push(cell.value);
    });

    console.log('=== HEADERS ===');
    console.log(JSON.stringify(headers, null, 2));
    console.log('\n=== SAMPLE ROWS (First 5 products) ===\n');

    // Get first 6 rows (1 header + 5 data rows)
    for (let i = 1; i <= Math.min(6, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const rowData = {};

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        rowData[header] = cell.value;
      });

      if (i === 1) {
        console.log(`Row ${i} (Headers):`);
      } else {
        console.log(`\nRow ${i}:`);
      }
      console.log(JSON.stringify(rowData, null, 2));
    }

  } catch (error) {
    console.error('Error reading file:', error);
    process.exit(1);
  }
}

readExcelFile();
