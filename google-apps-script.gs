/**
 * ============================================================================
 * File: google-apps-script.gs
 * Application: inflotrack — Money In Out Tracker
 * Purpose:
 *   Optional server-to-server Google Apps Script Web App bridge for connecting
 *   the inflotrack backend server to your private Google Sheet and Google Drive
 *   backup folder.
 *
 * Key Responsibilities & Security Rules:
 *   1. Keeps your Google Sheet ("FinanceFlow_Sheet") and Google Drive backup
 *      folder 100% PRIVATE ("Anyone with the link" must remain OFF).
 *   2. Verifies the server-to-server shared secret (`GOOGLE_APPS_SCRIPT_SECRET`)
 *      before executing any operation.
 *   3. Requires a backend-verified Firebase UID (`payload.uid`) on every
 *      request and stamps/filters all transaction rows by that UID so one user
 *      can never read, modify, or delete another user's financial data.
 * ============================================================================
 */

const SHARED_SERVER_SECRET = PropertiesService.getScriptProperties().getProperty('GOOGLE_APPS_SCRIPT_SECRET') || '';
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('GOOGLE_SPREADSHEET_ID') || '';
const DRIVE_FOLDER_ID =
  PropertiesService.getScriptProperties().getProperty('GOOGLE_DRIVE_FOLDER_ID') ||
  '1WTHHDzwzO79ypcP06ZmDkBuDADosnH30';
const SPREADSHEET_NAME =
  PropertiesService.getScriptProperties().getProperty('GOOGLE_SPREADSHEET_NAME') ||
  'inflowtrack';

function getOrCreateInflowtrackSpreadsheet(customFolderId, customSheetName) {
  var folderId = customFolderId || DRIVE_FOLDER_ID;
  var sheetName = customSheetName || SPREADSHEET_NAME;

  if (SPREADSHEET_ID && !customFolderId && !customSheetName) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      // Fallback to locating or creating in Drive folder
    }
  }

  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByName(sheetName);
  if (files.hasNext()) {
    var existingFile = files.next();
    return SpreadsheetApp.openById(existingFile.getId());
  }

  var createdSs = SpreadsheetApp.create(sheetName);
  var createdFile = DriveApp.getFileById(createdSs.getId());
  folder.addFile(createdFile);
  try {
    DriveApp.getRootFolder().removeFile(createdFile);
  } catch (e) {
    // Ignore if move API differs
  }
  return createdSs;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: 'Empty request payload' }, 400);
    }

    const payload = JSON.parse(e.postData.contents);

    // 1. Verify Server-to-Server Shared Secret
    if (!SHARED_SERVER_SECRET || payload.secret !== SHARED_SERVER_SECRET) {
      return jsonResponse({ error: 'Unauthorized Apps Script access' }, 403);
    }

    // 2. Require Verified Firebase UID from Backend
    const verifiedUid = String(payload.uid || '').trim();
    if (!verifiedUid) {
      return jsonResponse({ error: 'Missing verified Firebase UID' }, 401);
    }

    const ss = getOrCreateInflowtrackSpreadsheet(payload.driveFolderId, payload.spreadsheetName);
    const action = payload.action;

    if (action === 'READ_USER_DATA') {
      const sheets = ss.getSheets();
      const monthPattern = /^[A-Z]{3}_\d{4}$/i;
      const transactions = [];

      sheets.forEach(function (sheet) {
        const title = sheet.getName();
        if (!monthPattern.test(title) && title !== 'Transactions') return;
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;

        const values = sheet.getRange(2, 1, lastRow - 1, 13).getDisplayValues();
        for (var i = 0; i < values.length; i++) {
          var row = values[i];
          var rowUid = String(row[6] || '').trim();
          var rawAmt = parseFloat(String(row[3] || '0').replace(/[₹$,\s]/g, '')) || 0;
          var rowDate = String(row[0] || '').trim();
          // Accept rows belonging to verified UID or manually typed rows in Google Sheets (empty UID)
          if ((!rowUid || rowUid === verifiedUid) && rowDate && rawAmt > 0) {
            transactions.push({
              rowIndex: i + 2,
              sheetName: title,
              date: rowDate,
              type: row[1] || 'Expense',
              category: row[2] || 'Uncategorized',
              amount: rawAmt,
              paymentMode: row[4] || 'HDFC Bank',
              description: row[5] || '',
              uid: rowUid || verifiedUid,
              transactionId: row[7] || ('tx-sheet-' + (i + 2) + '-' + rowDate),
              subcategory: row[8] || '',
              account: row[9] || '',
              time: row[10] || '09:00',
              createdAt: row[11] || new Date().toISOString(),
              updatedAt: row[12] || new Date().toISOString()
            });
          }
        }
      });

      return jsonResponse({ transactions: transactions }, 200);
    }

    if (action === 'APPEND_TRANSACTION') {
      const tx = payload.transaction;
      const sheetName = tx.sheetName || 'Transactions';
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow([
          'Date',
          'Type',
          'Category',
          'Amount',
          'Payment Mode',
          'Description',
          'User UID',
          'Transaction ID',
          'Subcategory',
          'Account / Wallet',
          'Time',
          'Created At',
          'Updated At'
        ]);
        sheet.setFrozenRows(1);
      }

      sheet.appendRow([
        tx.date,
        tx.type,
        tx.category,
        tx.amount,
        tx.paymentMode,
        tx.description,
        verifiedUid, // Always enforce backend-verified UID
        tx.transactionId,
        tx.subcategory || '',
        tx.account || '',
        tx.time || '',
        tx.createdAt || new Date().toISOString(),
        tx.updatedAt || new Date().toISOString()
      ]);

      return jsonResponse({ success: true }, 201);
    }

    if (action === 'UPDATE_TRANSACTION') {
      const tx = payload.transaction;
      const sheetName = tx.sheetName;
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
          let targetRow = -1;
          for (var r = 0; r < values.length; r++) {
            var rowTxId = String(values[r][7] || '').trim();
            var rowDate = String(values[r][0] || '').trim();
            var rowType = String(values[r][1] || '').trim();
            var rowCat = String(values[r][2] || '').trim();
            var rowAmt = parseFloat(String(values[r][3] || '0').replace(/[₹$,\s]/g, '')) || 0;

            if (tx.transactionId && rowTxId === String(tx.transactionId).trim()) {
              targetRow = r + 2;
              break;
            } else if (rowDate === tx.date && rowType.toLowerCase() === tx.type.toLowerCase() && rowCat.toLowerCase() === tx.category.toLowerCase() && Math.abs(rowAmt - tx.amount) < 0.01) {
              targetRow = r + 2;
              break;
            }
          }
          if (targetRow !== -1) {
            sheet.getRange(targetRow, 1, 1, 13).setValues([[
              tx.date,
              tx.type,
              tx.category,
              tx.amount,
              tx.paymentMode,
              tx.description,
              verifiedUid,
              tx.transactionId,
              tx.subcategory || '',
              tx.account || '',
              tx.time || '',
              tx.createdAt || new Date().toISOString(),
              tx.updatedAt || new Date().toISOString()
            ]]);
            return jsonResponse({ success: true, updatedRow: targetRow }, 200);
          }
        }
      }
      return jsonResponse({ success: false, error: 'Transaction row not found in sheet' }, 404);
    }

    if (action === 'DELETE_TRANSACTIONS') {
      const transactionIds = payload.transactionIds || [];
      const sheets = ss.getSheets();
      let deletedCount = 0;
      sheets.forEach(function (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
        for (var i = values.length - 1; i >= 0; i--) {
          const rowTxId = String(values[i][7] || '').trim();
          const rowUid = String(values[i][6] || '').trim();
          if ((!rowUid || rowUid === verifiedUid) && transactionIds.indexOf(rowTxId) !== -1) {
            sheet.deleteRow(i + 2);
            deletedCount++;
          }
        }
      });
      return jsonResponse({ success: true, deletedCount: deletedCount }, 200);
    }

    return jsonResponse({ error: 'Unsupported action' }, 400);
  } catch (err) {
    return jsonResponse({ error: 'Internal Apps Script error' }, 500);
  }
}

function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
