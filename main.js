// main.js  -- a part of Caption Writer
//
//
"use strict";

const NODE_Util=require('node:util'); 
const Electron=require('electron');
const App=Electron.app;
const BrowserWindow=Electron.BrowserWindow;
const Ipc=Electron.ipcMain;
const Dialog=Electron.dialog
const Clipboard=Electron.clipboard;
const Path=require('node:path');
const FS=require('fs');
const ImageList=require(Path.join(__dirname,'js','imagelist'));
const Util=require(Path.join(__dirname,'js','util'));

const WINDOW_MIN_WIDTH=800;
const WINDOW_MIN_HEIGHT=720;

function usage(opts){
    const build_msg=(k,v)=>{
	if(!v)
	    return '';
	
	let s=`  --${k}`;
	let arg=v.type=='string' ? ' arg' : '';
	s+=arg;
	if(v.short)
	    s+=`, -${v.short}${arg}`;
	
	if(v.description)
	    s+=` : ${v.description}`;
	
	return s;
    };
    
    console.error('USAGE:');
    let help=null;
    for(const [k,v] of Object.entries(opts)){
	let msg=build_msg(k,v);
	if(k=='help')
	    help=msg;
	else
	    console.error(msg);
    }
    console.error('\n');
    if(help){
	console.error(help);
	console.error('\n');
    }
    
    App.exit(-1);
}

const CMD_OPTIONS={
    'config-file':{
	type:'string',
	short:'c',
	description:'full path of the configuration file'
    },
    'config-dir':{
	type:'string',
	short:'C',
	description:'configuration files directory'
    },
    'data-dir':{
	type:'string',
	short:'d',
	description:'data files directory'
    },
    'ignore-last-status':{
	type:'boolean',
	description:'ignore the last status file on start up'
    },
    'help':{
	type:'boolean',
	short:'h',
	description:'show this message and quit'
    }
};

const ARGS=process.argv.slice(2);
const OPTS=NODE_Util.parseArgs({
    args:ARGS,
    options:CMD_OPTIONS
}).values;

if(OPTS['help'])
    usage(CMD_OPTIONS);

const HOME=OPTS['config-dir']||require('os').homedir();
const RC_PREFIX='.capw';
const CONFIG_FILE=OPTS['config-file']||Path.join(HOME,RC_PREFIX);
const LAST_STAT_FILE=Path.join(HOME,RC_PREFIX+'.last-stat');

let config={
    DEBUG:false,
    save_last_status:true,
    ignore_last_status:false,
    window:{
	x:null,
	y:null,
	width:1024,
	height:768
    },
    UI:{
	hide_titlebar:false,
	auto_commit:true,
	dispose_without_confirm:false,
	spellcheck:true,
	autocomplete:false,
	lockscreen_message:''
    },
    wd:'.'
}

try{
    let c=JSON.parse(FS.readFileSync(CONFIG_FILE,'utf8'));
    Util.objectDeepMerge(config,c);
}
catch(e){
}

if(!(OPTS['ignore-last-status']||config.ignore_last_status)){
    try{
	let s=JSON.parse(FS.readFileSync(LAST_STAT_FILE,'utf8'));
	Util.objectDeepMerge(config,s);
    }
    catch(e){}
}

if(OPTS['data-dir'])
    config.wd=OPTS['data-dir'];

const AUTHOR=require(Path.join(__dirname,'package.json')).author;
const COPYRIGHT_YEAR='2024';
config.UI.appInfo={
    name:App.getName(),
    version:App.getVersion(),
    author:AUTHOR,
    year:COPYRIGHT_YEAR,
};

let win=null;
let imagelist=new ImageList({with_URIarm:true});

if(config.wd){
    try{
	imagelist.scan(config.wd);
    }
    catch(e){
	config.wd='.'
	console.log(e);
    }
}

let titlebar_style='default';
let titlebar_overlay=false;
if(config.UI.hide_titlebar){
    titlebar_style='hidden';
    titlebar_overlay={
	color:'#5a5a6a'
    };
}

App.on("ready", () => {
    win=new BrowserWindow({
	x:config.window.x,
	y:config.window.y,
	width:config.window.width,
	height:config.window.height,
	backgroundColor:'#2e2c29',
	useContentSize:false,
	titleBarStyle:titlebar_style,
	titleBarOverlay:titlebar_overlay,
	webPreferences:{
	    sandbox:false,
	    preload:Path.join(__dirname,'js','preload.js'),
	}
    });

    if(config.DEBUG)
	win.openDevTools({mode:'undocked'});
    else
	win.setMenu(null);
    
    win.setMinimumSize(WINDOW_MIN_WIDTH,WINDOW_MIN_HEIGHT);
    win.loadURL('file://'+__dirname+'/main.html');
    win.on(
	'close',
	async (event)=>{
	    let p=[
		new Promise(
		    (r)=>win.webContents.send('on-close')
		),
		new Promise(
		    (r)=>{
			if(config.save_last_status){
			    let j=JSON.stringify({
				window:win.getBounds(),
				wd:imagelist.cwd||imagelist._wd
			    },null,2);
			    try{
				FS.writeFileSync(LAST_STAT_FILE,j);
			    }
			    catch(e){
				console.log(e);
			    }
			}
			return null;
		    }
		),
		new Promise(
		    (r)=>setTimeout(()=>{},3)
		)
	    ];
	    await Promise.all(p).then((r)=>{});
	}
    );
    win.on("closed",()=>{
	win=null;
    });
});

App.on("window-all-closed",()=>{
    if(process.platform!="darwin"){
	App.quit();
    }
});

Ipc.handle(
    'get-config',
    (event)=>{
	return config.UI||{};
    }
);

const show_error=(t,m,y)=>{
    win.webContents.send(
	'show-error',
	{
	    title:t,
	    message:m,
	    type:y||'error'
	}
    );
};
let cwd=imagelist.cwd||config.wd;
Ipc.handle(
    'open-dir',
    async (event,path,preview)=>{
	path||=(imagelist.cwd||'.');
	let p=path;
	
	while(true){
	    if(preview)
		imagelist.get_dir(p)
	    else
		imagelist.scan(p);
	    
	    if(!imagelist._error)
		break;
	    
	    if(imagelist._error.code?.match(/(ENOENT|ENOTDIR)/)){
		//
		// when the given directory is not found,
		// try to access to the parent
		//
		let q=Path.resolve(Path.join(p,'..'));

		// when met errors on the root directory
		if(p==q){
		    // for removable drives on Windows
		    if(imagelist.is_drive && q!='C:\\'){
			p='C:\\';
		    }
		    else{
			show_error(
			    'Critical Error',
			    imagelist._error.message
			);
			break;
		    }
		}
		else
		    p=q;
	    }
	    else{	
		show_error(
		    `${imagelist._error.name}
 (${imagelist._error.errno})`,
		    imagelist._error.message
		);
		break;
	    }
	}
	    
	return imagelist.dump();
    }
);
Ipc.handle(
    'open-img',
    async (event,path)=>{
	let item=imagelist.get_image(path);
	if(item){
	    let img=await item.read_all();
	    if(img && !item._error)
		return img;
	    else
		return {error:item._error};
	}
	
	return item;
    }
);
Ipc.handle(
    'copy-anno',
    async (event,anno)=>{
	Clipboard.writeText(anno);
	return true;
    }
);
Ipc.handle(
    'read-anno',
    async (event,path)=>{
	let item=imagelist.get_image(path);
	if(item){
	    let anno=await item.read_annotation();
	    if(item._error){
		show_error(
		    `${item._error.name} (${item._error.errno})`,
		    item._error.message
		);
		anno=null;
	    }
	    return anno;
	}
	else
	    show_error(
		'Not found',
		`${path} is not found`
	    );

	return null;
    }
);

Ipc.handle(
    'write-anno',
    async (event,path,anno)=>{
	let item=imagelist.get_image(path);
	let retval=null;

	if(item && anno)
	    retval=await item.write_annotation(anno);
	
	if(!retval)
	    show_error(
		`${item._error.name} (${item._error.errno})`,
		item._error.message
	    );
	
	return retval;
    }
);
Ipc.handle(
    'rm-anno',
    async (event,path)=>{
	let item=imagelist.get_image(path);
	let retval=null;
	
	if(item){
	    retval=item.remove_annotation();
	    if(!retval)
		show_error(
		    `${item._error.name} (${item._error.errno})`,
		    item._error.message
		);
	}
	
	return retval;
    }
);

Ipc.handle(
    'undo',
    (event,arg)=>{
	return win.webContents.undo();
    }
);
Ipc.handle(
    'redo',
    (event,arg)=>{
	return win.webContents.redo();
    }
);
Ipc.handle(
    'paste',
    (event,arg)=>{
	return win.webContents.paste();
    }
);
Ipc.handle(
    'forceReload',
    (event,arg)=>{
	return win.webContents.reloadIgnoringCache();
    }
);
