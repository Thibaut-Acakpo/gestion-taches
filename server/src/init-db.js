require('dotenv').config();
const {Pool}=require('pg');const fs=require('fs');const path=require('path');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8')).then(()=>{console.log('Base initialisée');p.end()}).catch(e=>{console.error(e.message);p.end()});
