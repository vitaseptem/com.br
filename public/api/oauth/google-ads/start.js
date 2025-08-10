export default function handler(req,res){
  const cid = process.env.GOOGLE_CLIENT_ID, redir = process.env.GOOGLE_REDIRECT_URI;
  const scope = encodeURIComponent(["https://www.googleapis.com/auth/adwords","https://www.googleapis.com/auth/webmasters.readonly"].join(" "));
  const state = "vs_ga_" + Math.random().toString(36).slice(2);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${encodeURIComponent(redir)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
  res.writeHead(302,{ Location:url }); res.end();
}
