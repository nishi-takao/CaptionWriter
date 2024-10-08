// main.js  -- a part of Caption Writer
//
//
"use strict";

const Electron=require('electron');
const App=Electron.app;
const BrowserWindow=Electron.BrowserWindow;
const Ipc=Electron.ipcMain;
const Dialog=Electron.dialog
const Clipboard=Electron.clipboard;
const Path=require('node:path');
const FS=require('fs');
const ImageList=require('./js/imagelist');

const WINDOW_MIN_WIDTH=800;
const WINDOW_MIN_HEIGHT=720;


const HOME=require('os').homedir();
const RC_PREFIX='.capw';
const CONFIG_FILE=Path.join(HOME,RC_PREFIX);
const LAST_STAT_FILE=Path.join(HOME,RC_PREFIX+'.last-stat');

function getDriveList()
{
    if(process.platform=='win32'){
	try{
	    return require('child_process')
		.execSync(
		    'Get-WmiObject -Class Win32_logicaldisk|'+
			'Format-Wide -Property DeviceID -Column 1',
		    {shell:'powershell'}
		)
		.toString('utf8')
		.trim()
		.split(/\s+/);
	}
	catch(e){
	    console.log(e);
	    // on error, returns the current drive
	    return [process.cwd().slice(0,2)];
	}
    }
    else
	return null;
}

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
	auto_commit:true,
	lockscreen_message:''
    },
    cwd:'.'
}

try{
    let c=JSON.parse(FS.readFileSync(CONFIG_FILE,'utf8'));
    Object.assign(config,c);
}
catch(e){}


if(!config.ignore_last_status){
    try{
	let s=JSON.parse(FS.readFileSync(LAST_STAT_FILE,'utf8'));
	Object.assign(config,s);
    }
    catch(e){}
}

const AUTHOR=require(Path.join(__dirname,'package.json')).author;
const COPYRIGHT_YEAR=2024;
config.UI.appInfo={
    name:App.getName(),
    version:App.getVersion(),
    author:AUTHOR,
    year:COPYRIGHT_YEAR,
};

let win=null;
let imagelist=new ImageList({with_URIarm:true});

if(config.cwd){
    try{
	imagelist.scan(config.cwd);
    }
    catch(e){
	config.cwd='.'
	console.log(e);
    }
}

App.on("ready", () => {
    win=new BrowserWindow({
	x:config.window.x,
	y:config.window.y,
	width:config.window.width,
	height:config.window.height,
	backgroundColor:'#2e2c29',
	useContentSize:false,
	webPreferences:{
	    sandbox:false,
	    preload:Path.join(__dirname,'js','preload.js'),
	    //nodeIntegration:true,
	    //contextIsolation:false,
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
				cwd:imagelist.cwd
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

let cwd=imagelist.cwd||config.cwd;
Ipc.handle(
    'open-dir',
    async (event,arg)=>{
	let path=null;
	if(arg)
	    path=[arg];
	else{
	    let default_path=imagelist.cwd||'.';
	    path=Dialog.showOpenDialogSync(
		win,
		{
		    title:'Select Directory',
		    defaultPath:default_path,
		    properties:['openDirectory','showHiddenFiles']
		}
	    );
	}
	
	if(path){
	    event.sender.send(
		'ack-open',
		{
		    type:'dir',
		    target:path[0]
		}
	    );
	    imagelist.scan(path[0],false);
	}
	
	return imagelist.dump();
    }
);
Ipc.handle(
    'open-img',
    async (event,path)=>{
	let item=imagelist.get_image(path);
	if(item){
	    event.sender.send(
		'ack-open',
		{
		    type:'file',
		    target:path
		}
	    );
	    item=await item.read_all();
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
	    event.sender.send(
		'ack-open',
		{
		    type:'file',
		    target:path
		}
	    );
	    item=await item.read_annotation();
	}
	
	return item;
    }
);

Ipc.handle(
    'write-anno',
    async (event,path,anno)=>{
	let item=imagelist.get_image(path);
	let retval=null;

	if(item && anno){
	    event.sender.send(
		'ack-open',
		{
		    type:'file',
		    target:path
		}
	    );
	    retval=await item.write_annotation(anno);
	}
	if(!retval){
	    win.webContents.send(
		'show-error',
		{
		    title:'I/O Error',
		    message:`Some errors occurred when writing.
See the console for details.`
		}
	    );
	}
	return retval;
    }
);
Ipc.handle(
    'rm-anno',
    async (event,path)=>{
	let item=imagelist.get_image(path);
	let retval=null;
	
	if(item){
	    event.sender.send(
		'ack-open',
		{
		    type:'file',
		    target:path
		}
	    );
	    retval=item.remove_annotation();
	    if(!retval){
		win.webContents.send(
		    'show-error',
		    {
			title:'I/O Error',
			message:`Some errors occurred when writing.
See the console for details.`
		    }
		);
	    }
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
