import cors from "cors";

/*origin: [
  "https://www.nooms.onrender.com",
  "https://nooms.onrender.com",
  "nooms.onrender.com",
],*/

const corsObj = {
  origin: "*",
  methods: ["GET", "PUT", "POST", "DELETE"],
  allowedHeaders: [
    "Access-Control-Allow-Headers",
    "X-Requested-With",
    "X-Access-Token",
    "Content-Type",
    "Host",
    "Accept",
    "Connection",
    "Cache-Control",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

export const corsHeader = corsObj;
export const corsPayload = cors(corsObj);
