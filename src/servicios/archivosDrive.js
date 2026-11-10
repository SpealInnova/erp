const { Readable } = require("stream");
const { google } = require("googleapis");

function crearClienteDrive() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oAuth2Client });
}

async function subirArchivo({ nombre, mimeType, buffer, parentId }) {
  const drive = crearClienteDrive();
  const carpetaDestino = parentId || process.env.DRIVE_FOLDER_ID;
  const respuesta = await drive.files.create({
    requestBody: {
      name: nombre,
      parents: carpetaDestino ? [carpetaDestino] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });
  return { driveFileId: respuesta.data.id, driveEnlace: respuesta.data.webViewLink };
}

async function crearCarpeta({ nombre, parentId }) {
  const drive = crearClienteDrive();
  const respuesta = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return { id: respuesta.data.id };
}

module.exports = { subirArchivo, crearCarpeta };
