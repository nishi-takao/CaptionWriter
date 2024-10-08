// preload.js -- a part of Caption Writer
//
// NISHI, Takao <nishi.t.es@osaka-u.ac.jp
//
const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld(
    'extra',
    {
	api:{
	    reg_on_start_loading_handler:(callback)=>{
		ipcRenderer.on(
		    'ack-open',
		    (event,args)=>{
			callback(args);
		    }
		);
	    },
	    
	    reg_on_error_handler:(callback)=>{
		ipcRenderer.on(
		    'show-error',
		    (event,args)=>{
			callback(args);
		    }
		);
	    },
	    
	    reg_on_close_handler:(callback)=>{
		ipcRenderer.on(
		    'on-close',
		    (event)=>{
			callback();
		    }
		);
	    },

	    get_config:()=>{
		return ipcRenderer.invoke('get-config');
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
	    undo:()=>{
		return ipcRenderer.invoke('undo');
	    },
	    redo:()=>{
		return ipcRenderer.invoke('redo');
	    },
	    paste:(anno)=>{
		return ipcRenderer.invoke('paste');
	    },
	    reload:()=>{
		return ipcRenderer.invoke('forceReload');
	    }
	}
    }
);
