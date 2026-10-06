require("dotenv").config();
const http = require("http");
const { URL } = require("url");
const { google } = require("googleapis");

const PUERTO = 53682;
const REDIRECT_URI = `http://localhost:${PUERTO}/callback`;

async function autorizar() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET en el .env local.");
    process.exit(1);
    return;
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const urlAutorizacion = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
  });

  console.log("\n1. Abre esta URL en el navegador, con la cuenta de Workspace que va a enviar los correos:\n");
  console.log(urlAutorizacion);
  console.log(
    "\n2. Autoriza el acceso. El navegador redirige a localhost — este script lo captura solo.\n"
  );

  const codigo = await esperarCodigo();
  const { tokens } = await oAuth2Client.getToken(codigo);

  console.log("\nListo. Agrega esto como GMAIL_REFRESH_TOKEN en las variables de entorno del sitio:\n");
  console.log(tokens.refresh_token);
}

function esperarCodigo() {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PUERTO}`);
      const codigo = url.searchParams.get("code");
      res.end("Autorización recibida, puedes cerrar esta pestaña.");
      servidor.close();
      if (codigo) {
        resolve(codigo);
      } else {
        reject(new Error("No se recibió el código de autorización."));
      }
    });
    servidor.listen(PUERTO);
  });
}

autorizar().catch((error) => {
  console.error("Error en la autorización:", error);
  process.exit(1);
});
