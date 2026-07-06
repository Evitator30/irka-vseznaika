const http=require('http');
const fs=require('fs');
const path=require('path');

const root=__dirname;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.md':'text/markdown; charset=utf-8'};

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    let relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).replace(/^[/\\]+/,'');
    const file=path.resolve(root,relative);
    if(!file.startsWith(path.resolve(root)+path.sep)){res.statusCode=403;return res.end('Forbidden')}
    fs.readFile(file,(err,data)=>{if(err){res.statusCode=404;return res.end('Not found')}res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.end(data)});
  }catch(err){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:err.message||'Ошибка сервера'}))}
});
const port=Number(process.env.PORT)||4186;
server.listen(port,'127.0.0.1',()=>console.log(`\n  Ирка-всезнайка запущена: http://127.0.0.1:${port}\n  Не закрывайте это окно, пока пользуетесь сайтом.\n`));
