const dotenv = require("dotenv");
const tr = require("tor-request");

const request = async (
  url: string
): Promise<{ statusText: string; status: number; data: string }> => {
  return new Promise((resolve, reject) => {
    tr.request(
      {
        url,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:87.0) Gecko/20100101 Firefox/87.0",
        },
      },
      (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            statusText: response.statusMessage,
            status: response.statusCode,
            data: response.body,
          });
        }
      }
    );
  });
};

const rotateIP = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    tr.newTorSession((err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

dotenv.config();
tr.TorControlPort.password = process.env.TOR_PASSWORD || "password";

export { request, rotateIP };
