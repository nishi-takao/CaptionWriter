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
const ImageList=require('./js/imagelist');

const WINDOW_MIN_WIDTH=800;
const WINDOW_MIN_HEIGHT=720;

let config={
    DEBUG: true,
    window:{
	x:null,
	y:null,
	width:1024,
	height:768
    },
    cwd:'.'
}

let win=null;
let imagelist=new ImageList();


App.on("ready", () => {
    win=new BrowserWindow({
	width:config.window.width,
	height:config.window.height,
	useContentSize:true,
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
    win.on("closed",()=>{
	win=null;
    });
});

App.on("window-all-closed",()=>{
    if(process.platform!="darwin"){
	App.quit();
    }
});

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
		    properties:['openDirectory']
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
	if(!retval)
	    Dialog.showErrorBox(
		'I/O Error',
		`Some errors occurred when writing.
See the console for details.
`
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
	    retval=Dialog.showMessageBoxSync(
		win,
		{
		    title:'Confirmation',
		    type:'question',
		    message:'Are you sure you want to dispose the saved caption?',
		    buttons:['cancel','OK'],
		    defaultId:0
		}
	    );
	    if(retval){
		event.sender.send(
		    'ack-open',
		    {
			type:'file',
			target:path
		    }
		);
		retval=item.remove_annotation(path);
		if(!retval)
		    Dialog.showErrorBox(
			'I/O Error',
			`Some errors occurred when removing.
See the console for details.
`
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
