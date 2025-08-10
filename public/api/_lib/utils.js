import crypto from "crypto";

export function json(res, code, body){ res.status(code).setHeader("content-type","application/json"); res.end(JSON.stringify(body)); }
export function ok(res, body={ ok:true }){ return json(res, 200, body); }
export function bad(res, msg="bad_request"){ return json(res, 400, { error: msg }); }
export function unauthorized(res){ return json(res, 401, { error:"unauthorized" }); }
export function hmacVerify(payload, headerSignature, secret){
  const h = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(headerSignature||"", "utf8"));
}
export function allowCors(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization,x-signature");
}
export function isOptions(req, res){ if (req.method==="OPTIONS"){ allowCors(res); res.status(200).end(); return true; } return false; }
