export default function handler(req,res){
  const p = req.query.provider;
  if (p==="stripe") return res.writeHead(302,{ Location:"/api/oauth/stripe/start" }).end();
  if (p==="pix") return res.writeHead(302,{ Location:"/api/webhooks/pix" }).end(); // placeholder
  return res.status(200).send(`Conexão para ${p} ainda não implementada aqui.`);
}
