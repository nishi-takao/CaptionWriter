// preload.js -- a part of Caption Writer
//
// NISHI, Takao <nishi.t.es@osaka-u.ac.jp
//
const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld(
    'extra',
    {
	api:{
	    on_start_loading:(func)=>{
		ipcRenderer.on(
		    'ack-open',
		    (event,args)=>{
			func(args);
		    }
		);
	    },
	    open_dir:(path)=>{
		return ipcRenderer.invoke('open-dir',path);
	    },
	    open_img:(path)=>{
		return ipcRenderer.invoke('open-img',path);
	    },
	    copy_anno:(anno)=>{
		return ipcRenderer.invoke('copy-anno',anno);
	    },
	    read_anno:(path)=>{
		return ipcRenderer.invoke('read-anno',path);
	    },
	    write_anno:(path,anno)=>{
		return ipcRenderer.invoke('write-anno',path,anno);
	    },
	    rm_anno:(path)=>{
		return ipcRenderer.invoke('rm-anno',path);
	    },
	    show_dialog:(opt)=>{
		return ipcRenderer.invoke('show-dialog',opt);
	    },
	    undo:()=>{
		return ipcRenderer.invoke('undo');
	    },
	    redo:()=>{
		return ipcRenderer.invoke('redo');
	    },
	    paste:(anno)=>{
		return ipcRenderer.invoke('paste');
	    },
	    get_config:()=>{
		return ipcRenderer.invoke('get-config');
	    }
	}
    }
);
