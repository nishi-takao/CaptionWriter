//
//
//
const API=window.extra.api;
const MAX_DIRNAME_LEN=64;

const COPYRIGHT_YEAR=2024;
const COPYRIGHT_AUTHOR_NAME='NISHI, Takao';
const COPYRIGHT_AUTHOR_EMAIL='nishi.t.es@osaka-u.ac.jp';

function escapeHTML(str)
{
    return str
	.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
	.replace(/`/g, '&#x60;');
}

function Director(config={})
{
    this._config={};
    this._set_config(config);
    
    this._lock_render='lock-render';
    
    this.cwd=null;
    this._list_size=0;
    this._list_cursor_pos=null;
    this._current_image=null;
    this._has_changed=false;
    this._last_commit_anno=null;

    //
    // object caches
    //
    this.element={};
    this.element.cwd=document.getElementById('cwd');
    this.element.filelist=document.getElementById('filelist');
    this.element.img_area=document.getElementById('image-area');
    this.element.src_img=document.getElementById('target-image');
    this.element.loading_img=document.getElementById('loading-image');
    this.element.caption=document.getElementById('caption');
    this.element.lock=document.getElementById('lock');
    
    //
    // buttons
    //
    this.element.btn={};
    this.element.btn.list_open=document.getElementById('btn-list-open');
    this.element.btn.list_rescan=document.getElementById('btn-list-rescan');

    this.element.btn.edit_commit=document.getElementById('btn-edit-commit');
    this.element.btn.edit_paste=document.getElementById('btn-edit-paste');
    this.element.btn.edit_undo=document.getElementById('btn-edit-undo');
    this.element.btn.edit_redo=document.getElementById('btn-edit-redo');
    this.element.btn.edit_discard=document.getElementById('btn-edit-discard');
    this.element.btn.edit_dispose=document.getElementById('btn-edit-dispose');
    
    this._edit_buttons=[
	this.element.btn.edit_commit,
	this.element.btn.edit_paste,
	this.element.btn.edit_undo,
	this.element.btn.edit_redo,
	this.element.btn.edit_discard,
	this.element.btn.edit_dispose
    ];

    // size caches
    this.el_size={};

    this._add_listeners();

    this._unset_anno_changed();
}

Director.prototype.cmd_dir_open=function(force)
{
    if((!force)&&(!this._is_btn_active(this.element.btn.list_open)))
	return;
    
    this._set_all_inactive();
    API.open_dir().then(
	(result)=>{
	    Promise.all([this._render_(result)]);
	    this._set_btn_active(this.element.cwd);
	    this._set_btn_active(this.element.btn.list_open);
	    this._set_btn_active(this.element.btn.list_rescan);
	},
	(e)=>{
	    console.log(e);
	}
    );
}

Director.prototype.cmd_dir_rescan=function()
{
    if(!this._is_btn_active(this.element.btn.list_rescan))
	return;
    this._set_all_inactive();

    API.open_dir(this.cwd).then(
	(result)=>{
	    Promise.all([this._render_(result,true)]);
	    this._set_btn_active(this.element.cwd);
	    this._set_btn_active(this.element.btn.list_open);
	    this._set_btn_active(this.element.btn.list_rescan);
	},
	(e)=>{
	    console.log(e);
	    this.cmd_dir_open(true);
	}
    );
}

Director.prototype.cmd_list_up=function()
{
    if(!this._list_size)
	return;
    
    if(this._list_cursor_pos==null){
	this.cmd_image_open(0,true);
	return;
    }
    this.cmd_image_open(this._list_cursor_pos-1,true);
}

Director.prototype.cmd_list_down=function()
{
    if(!this._list_size)
	return;
    
    if(this._list_cursor_pos==null){
	this.cmd_image_open(0,true);
	return;
    }
    this.cmd_image_open(this._list_cursor_pos+1,true);
}

Director.prototype.cmd_image_open=function(idx,keep_focus)
{
    let path=this._idx2path(idx);
    if(!path)
	return;
    
    API.open_img(path).then(
	(result)=>{
	    if(result)
		this._show_image_(idx,result,keep_focus);
	},
	(e)=>{
	    console.log(e)
	}
    );
}

Director.prototype.cmd_edit_start=function()
{
    if(!this._list_size)
	return;

    let el=this.element.caption;
    let len=el.value.length;
    el.focus();
    el.setSelectionRange(len,len);
}

Director.prototype.cmd_edit_copy_anno=function()
{
    if((!this._list_size)||(this._list_cursor_pos==null))
	return;
    
    let el=this._get_list_item(this._list_cursor_pos);
    if((!el) || (!el.dataset.hasAnnotation))
	return;

    let anno=this.element.caption.value;
    if(!anno)
	return;

    this._copy_anno_(anno);
}

Director.prototype.cmd_edit_clear_copied_anno=function()
{
    this._last_commit_anno=null;

    let cls=this.element.btn.edit_paste.getAttribute('class')
    cls=cls.replaceAll('fa-solid','fa-regular');
    this.element.btn.edit_paste.setAttribute('class',cls)
}


Director.prototype.cmd_edit_commit=function(keep_focus)
{
    if(keep_focus){
	this._do_commit();
	this.element.caption.focus();
    }
    else
	this.element.filelist.focus();
}

Director.prototype.cmd_edit_paste_tlc=function()
{
    if(!this._last_commit_anno)
	return;
    
    this._do_paste_();
}

Director.prototype.cmd_edit_undo=function()
{
    API.undo();
    this.element.caption.focus();
}

Director.prototype.cmd_edit_redo=function()
{
    API.redo();
    this.element.caption.focus();
}

Director.prototype.cmd_edit_discard=function()
{
    if(!this._current_image)
	return;

    let path=this._current_image.dataset.path;
    if(path)
	path=decodeURI(path);
    else
	return;
    
    var anno;
    API.read_anno(path).then(
	(anno)=>{
	    this._show_anno_(anno);
	},
	(e)=>{
	    console.log(e);
	}
    );
}

Director.prototype.cmd_edit_dispose=function()
{
    this._do_dispose();
    this.element.filelist.focus();
}


Director.prototype._add_listeners=function()
{
    //
    // buttons
    //
    this.element.cwd.addEventListener(
	'click',
	this.cmd_dir_open.bind(this));
    this.element.btn.list_open.addEventListener(
	'click',
	this.cmd_dir_open.bind(this));
    this.element.btn.list_rescan.addEventListener(
	'click',
	this.cmd_dir_rescan.bind(this));

    this.element.btn.edit_commit.addEventListener(
	'click',
	this.cmd_edit_commit.bind(this));
    this.element.btn.edit_paste.addEventListener(
	'click',
	this.cmd_edit_paste_tlc.bind(this));
    this.element.btn.edit_undo.addEventListener(
	'click',
	this.cmd_edit_undo.bind(this));
    this.element.btn.edit_redo.addEventListener(
	'click',
	this.cmd_edit_redo.bind(this));
    this.element.btn.edit_discard.addEventListener(
	'click',
	this.cmd_edit_discard.bind(this));
    this.element.btn.edit_dispose.addEventListener(
	'click',
	this.cmd_edit_dispose.bind(this));

    
    //
    // filelist keys
    //
    this.element.filelist.addEventListener(
	'keydown',
	(event)=>{
	    switch(event.key){
	    case 'ArrowUp':
		event.preventDefault();
		this.cmd_list_up();
		break;
	    case 'ArrowDown':
		event.preventDefault();
		this.cmd_list_down();
		break;
	    case 'ArrowRight':
	    case 'Enter':
		event.preventDefault();
		this.cmd_edit_start();
		break;
	    case 'ArrowLeft':
		event.preventDefault();
		if(event.ctrlKey && event.shiftKey)
		    this.cmd_edit_clear_copied_anno();
		else
		    this.cmd_edit_copy_anno();
		break;
	    case 'Delete':
		if(event.ctrlKey){
		    event.preventDefault();
		    this.cmd_edit_dispose();
		}
		break;
	    default:
		//console.log([event,event.key.charCodeAt()]);
	    }
	}
    );
    this.element.filelist.setAttribute(
	'title',
	`[\u2191]: List Up
[\u2193]: List Down
[\u2192] or [RET] or [TAB]: Start Editing
[\u2190]: Copy the Existing Caption
[Ctrl-Shft-\u2190]: Clear the Copied Caption
[Ctrl-DEL]: Dispose the Existing Caption
`
   );
   this.element.filelist.addEventListener(
	'blur',
       (event)=>{
	   if((!event.relatedTarget)||
	      (event.relatedTarget==this.element.caption &&
	       !this._current_image))
	       this.element.filelist.focus();
       }
   );

    

    
    //
    // text-area
    //
    this.element.caption.addEventListener(
	'focus',
	(event)=>{
	    if(!this._current_image)
		this.element.filelist.focus();
	    else
		this._set_edit_btn_active();
	}
    );
    this.element.caption.addEventListener(
	'blur',
	(event)=>{
	    if(!this._edit_buttons.includes(event.relatedTarget)){
		if(event.relatedTarget==this.element.lock){
		    this.element.lock.dataset.relatedTarget=
			this.element.caption.id;
		    return;
		}
		this._do_commit();
		this._set_edit_btn_inactive();
		if(!event.relatedTarget)
		    this.element.filelist.focus();
	    }
	}
    );
    this.element.caption.addEventListener(
	'keydown',
	(event)=>{
	    switch(event.key){
	    case 's':
		if(event.ctrlKey){
		    event.preventDefault();
		    this.cmd_edit_commit(true);
		}
		break;
	    case 'Enter':
		if(event.ctrlKey){
		    event.preventDefault();
		    this.cmd_edit_commit();
		}
		break;
	    case 'Escape':
		event.preventDefault();
		let el=this.element.caption;
		if(el.selectionStart!=el.selectionEnd)
		    el.selectionEnd=el.selectionStart
		else if(this._has_changed)
		    this.cmd_edit_discard();
		else
		    this.element.filelist.focus();
		break;
	    }
	}
    );
    this.element.caption.setAttribute(
	'title',
	`[Ctrl-s]: Commit and Continue Editing
[Ctrl-RET] or [TAB]: Commit
[ESC]: Discard`
    );
    

    //
    // lock screen
    //
    this.element.lock.addEventListener(
	'keypress',
	(event)=>{
	    event.preventDefault();
	    event.stopPropagation();
	    switch(event.key){
	    case 'L':
		if(event.ctrlKey){
		    this._unset_lock();
		}
		break;
	    }
	}
    );
    document.getElementById('lock-message').textContent=
	this._config.lockscreen_messgae||'[Ctrl-Shift-l] to unlock';

    document.getElementById('lock-bottom').innerHTML=
	`${this._config.appName} ${this._config.appVersion}
&copy; ${COPYRIGHT_YEAR}
by ${COPYRIGHT_AUTHOR_NAME} &lt;${COPYRIGHT_AUTHOR_EMAIL}&gt;`;
     
    //
    // global short-cut keys
    //
    window.addEventListener(
	'keypress',
	(event)=>{
	    switch(event.key){
	    case 'Delete':
		if(event.ctrlKey)
		    this.cmd_edit_dispose();
		break;
	    case 'Enter':
		if(event.ctrlKey)
		    this.cmd_edit_commit();
		break;
	    case 'V':
		if(event.ctrlKey)
		    this.cmd_edit_paste_tlc();
		break;
	    case 'D':
		if(event.ctrlKey)
		    this.cmd_edit_discard();
		break;
	    case 'o':
		if(event.ctrlKey)
		    this.cmd_dir_open();
		break;
	    case 'r':
		if(event.ctrlKey){
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_rescan();
		}
		break;
	    case 'F5':
		this.cmd_rescan();
		break;
	    case 'L':
		if(event.ctrlKey){
		    event.preventDefault();
		    this._set_lock();
		}
		break;
	    default:
		//console.log([event,event.key.charCodeAt()]);
	    }
	}
    );

    //
    // add short cut key description to tool tip
    //
    this._add_text_to_title(
	this.element.btn.list_open,
	'Ctrl-o'
    );
    this._add_text_to_title(
	this.element.btn.list_rescan,
	'F5 or Ctrl-r'
    );
    this._add_text_to_title(
	this.element.btn.edit_commit,
	'Ctrl-RET'
    );
    this._add_text_to_title(
	this.element.btn.edit_paste,
	'Ctrl-Shift-v'
    );
    this._add_text_to_title(
	this.element.btn.edit_undo,
	'Ctrl-z'
    );
    this._add_text_to_title(
	this.element.btn.edit_redo,
	'Ctrl-y'
    );
    this._add_text_to_title(
	this.element.btn.edit_discard,
	'Ctrl-Shift-d'
    );
    this._add_text_to_title(
	this.element.btn.edit_dispose,
	'Ctrl-DEL'
    );
    
    // declaring as oneshot event for avoiding re-entrance
    const func=async (event)=>{
	    await this._resize_();
	    window.addEventListener(
		'resize',
		func,
		{once:true}
	    );
    };
    window.addEventListener(
	'resize',
	func,
	{once:true}
    );
}

Director.prototype._add_text_to_title=function(el,text)
{
    let title=(el.getAttribute('title')||'')+' ['+text+']';
    el.setAttribute('title',title.trim());
}

Director.prototype._resize_=async function()
{
    let cw,ch;
    await navigator.locks.request(
	this._lock_render,
	{ ifAvailable: true },
	(lock)=>{
	    [cw,ch]=this._fit_image();
	}
    );

    return true;
}

Director.prototype._fit_image=function()
{
    if(!this.el_size.image_area_pad_w)
	this.el_size.image_area_pad_w=parseInt(
	    window.getComputedStyle(this.element.img_area)['padding-left']
	)+parseInt(
	    window.getComputedStyle(this.element.img_area)['padding-right']
	);
    if(!this.el_size.image_area_pad_h)
	this.el_size.image_area_pad_h=parseInt(
	    window.getComputedStyle(this.element.img_area)['padding-top']
	)+parseInt(
	    window.getComputedStyle(this.element.img_area)['padding-bottom']
	);
    
    const Pw=this.element.img_area.offsetWidth;
    const Ph=this.element.img_area.offsetHeight;
    
    let cw=Pw-this.el_size.image_area_pad_w;
    let ch=Ph-this.el_size.image_area_pad_h;
    
    if(!this._current_image)
	return [cw,ch];
    
    const Ow=parseInt(this._current_image.dataset.originalWidth);
    const Oh=parseInt(this._current_image.dataset.originalHeight);
    
    if((Ow<=cw) &&
       (Oh<=ch)){
	cw=Ow;
	ch=Oh;
    }
    else{
	const Oaspect=Ow/Oh;
	let tw=ch*Oaspect;
	if(tw<=cw)
	    cw=tw;
	else
	    ch=cw/Oaspect;
    }
    
    this._current_image.setAttribute('width',cw);
    this._current_image.setAttribute('height',ch);
    this._current_image.style.width=cw+'px';
    this._current_image.style.height=ch+'px';
    
    this._current_image.style.left=(Pw-cw)/2+'px';
    this._current_image.style.top=(Ph-ch)/2+'px';
    
    return [cw,ch];
}

Director.prototype._render_=async function(imagelist,keep_image)
{
    if(!imagelist){
	this._unset_loading();
	return;
    }

    if(this.cwd==imagelist.cwd)
	keep_image=true;
    
    var last_anno=null;
    await navigator.locks.request(this._lock_render,(lock)=>{
	this._erase_body(false,keep_image);

	this._set_cwd(imagelist.cwd);
	last_anno=this._build_filelist(imagelist);

	this._fit_image();
    });

    this._unset_loading();
    if(keep_image && this._list_cursor_pos!=null){
	let el=this._get_list_item(this._list_cursor_pos);
	el.focus();
    }
    else if(this._list_size)
	this.cmd_image_open(last_anno==null ? 0 : last_anno,true);

    this.element.filelist.focus();
}

Director.prototype._erase_body=function(keep_list,keep_img)
{
    if(!keep_img)
	this._close_current_image();
    
    if(keep_list)
	return;
    
    //
    // clear header
    //
    this.cwd=null;
    this.element.cwd.innerText='';
    this.element.cwd.removeAttribute('title');
    
    //
    // clear list
    //
    while(this.element.filelist.firstChild)
	this.element.filelist.removeChild(this.element.filelist.firstChild);
    this._list_cursor_pos=null;
}

Director.prototype._set_cwd=function(cwd)
{
    this.cwd=cwd;
    let str=cwd;
    let len=str.length;
    if(len>MAX_DIRNAME_LEN)
	str='...'+str.substring(len-MAX_DIRNAME_LEN-3);

    this.element.cwd.textContent=str;
    this.element.cwd.setAttribute('title',escapeHTML(cwd));
}

Director.prototype._build_filelist=function(imagelist)
{
    let old_path=null;
    if(this._current_image)
	old_path=decodeURI(this._current_image.dataset.path);

    let idx=0,last_anno_idx=null;
    if(imagelist.images && imagelist.images.length>0){
	this._list_size=imagelist.images.length;
	
	imagelist.images.forEach(function(obj){
	    let li=document.createElement('li');
	    li.textContent=obj.basename;

	    li.dataset.path=encodeURI(obj.path);
	    li.dataset.idx=idx;
	    li.setAttribute('tabindex',-1);
	    li.setAttribute('title','');
	    
	    if(obj.has_annotation){
		li.dataset.hasAnnotation='true';
		last_anno_idx=idx;
	    }
	    if(old_path==obj.path){
		li.setAttribute('class','selected');
		this._list_cursor_pos=idx;
	    }
	    
	    li.addEventListener("click",
				this.cmd_image_open.bind(this,idx,false),
				false);
	    
	    this.element.filelist.appendChild(li);
	    
	    idx+=1;
	},this);
	this._set_btn_active(this.element.caption);
    }
    else{
	let li=document.createElement('li');
	li.setAttribute('class','no-image');
	this.element.filelist.appendChild(li);
	this._set_btn_inactive(this.element.caption);
	this._list_size=0;
    }

    return last_anno_idx;
}

Director.prototype._idx2path=function(idx)
{
    let el=this.element.filelist.getElementsByTagName('li')[idx];
    if(el)
	return el.dataset.path;
    else
	return el;
}
Director.prototype._show_image_=async function(idx,obj,keep_focus)
{
    await navigator.locks.request(
	this._lock_render,
	(lock)=>{
	    this._close_current_image();

	    this._set_list_select(idx);
	    let el=this.element.src_img;
	    el.setAttribute('src',obj.image.body);
	    el.dataset.originalWidth=obj.image.width;
	    el.dataset.originalHeight=obj.image.height;
	    el.dataset.path=this._idx2path(idx);
	    el.dataset.idx=idx;
	    
	    
	    this._current_image=el;
	    this._fit_image();
	    this._current_image.style.display='inline-block';
	    
	    this._set_anno(obj.anno);
	    el=this._get_list_item(idx);
	    if(el && el.dataset.hasAnnotation)
		this._set_btn_active(this.element.btn.edit_dispose);
	    else
		this._set_btn_inactive(this.element.btn.edit_dispose);
	    
	    this._unset_loading();
	}
    );

    if(keep_focus)
	this.element.filelist.focus();
    else
	this.cmd_edit_start();
}
Director.prototype._show_anno_=async function(anno)
{
    await navigator.locks.request(
	this._lock_render,
	(lock)=>{
	    this._set_anno(anno);
	    this._unset_loading();
	}
    );
    this.element.caption.focus();

}
Director.prototype._set_anno=function(anno)
{
    let el=this.element.caption;
    if(anno)
	el.value=anno;
    else
	el.value='';
    
    this._unset_anno_changed();
    
    el.addEventListener(
	'input',
	this._set_anno_changed.bind(this),
	{once:true}
    );
}

Director.prototype._close_current_image=function()
{
    
    if(!this._current_image)
	return;
    
    this.element.caption.removeEventListener(
	'input',
	this._set_anno_changed.bind(this),
	{once:true}
    );
    this.element.caption.value='';
    this._unset_anno_changed();
    
    this._unset_list_select(this._current_image.dataset.idx);
    this._current_image.style.display='none';
    this._current_image=null;
}

Director.prototype._get_list_item=function(idx)
{
    return this.element.filelist.getElementsByTagName('li')[parseInt(idx)];
}
Director.prototype._set_list_select=function(idx)
{
    let el=this._get_list_item(idx);
    if(!el)
	return null;
    
    let cls=el.getAttribute('class');
    if(!cls)
	cls=''
    cls=(cls+' selected').trim();
    el.setAttribute('class',cls);
    this._list_cursor_pos=parseInt(idx);
    el.scrollIntoViewIfNeeded(false); // depends on WebKit
    return el;
}
Director.prototype._unset_list_select=function(idx)
{
    let el=this._get_list_item(idx);
    if(!el)
	return;
    let cls=el.getAttribute('class');
    if(!cls)
	return;

    cls=cls.replaceAll('selected','').trim();
    el.setAttribute('class',cls);
}
Director.prototype._set_anno_changed=function()
{
    this._has_changed=true;
    this._set_btn_active(this.element.btn.edit_commit);
    this._set_btn_active(this.element.btn.edit_undo);
    this._set_btn_active(this.element.btn.edit_redo);
    this._set_btn_active(this.element.btn.edit_discard);
    //this._set_btn_active(this.element.btn.edit_dispose);
}
Director.prototype._unset_anno_changed=function()
{
    this._set_btn_inactive(this.element.btn.edit_commit);
    this._set_btn_inactive(this.element.btn.edit_undo);
    this._set_btn_inactive(this.element.btn.edit_redo);
    this._set_btn_inactive(this.element.btn.edit_discard);
    this._has_changed=false;
}
Director.prototype._set_edit_btn_active=function()
{
    if(this._last_commit_anno)
	this._set_btn_active(this.element.btn.edit_paste);
}    
Director.prototype._set_edit_btn_inactive=function()
{
    // reject dispose button
    this._edit_buttons.filter(
	(x)=>x!=this.element.btn.edit_dispose
    ).forEach((obj)=>{
	if(obj!=this.element.btn.edit_dispose)
	    this._set_btn_inactive(obj);
    });
} 

Director.prototype._set_btn_active=function(obj)
{
    obj.removeAttribute('disabled');
}
Director.prototype._set_btn_inactive=function(obj)
{
    obj.setAttribute('disabled','');
}
Director.prototype._is_btn_active=function(obj)
{
    return obj.getAttribute('disabled')==null;
}
Director.prototype._set_all_inactive=function()
{
    this._set_btn_inactive(this.element.cwd);
    Object.values(this.element.btn).forEach((el)=>{
	this._set_btn_inactive(el);
    });
}


Director.prototype._do_commit=function()
{
    if((!this._current_image)||(!this._has_changed))
	return;
    
    let path=this._current_image.dataset.path;
    if(path==null)
	return;
    else
	path=decodeURI(path);
    
    let anno=this.element.caption.value;
    if(!anno){
	let el=this._get_list_item(this._list_cursor_pos);
	if((!el) || (!el.dataset.hasAnnotation))
	    return;

	this._do_dispose();
    }
    else{
	API.write_anno(path,anno).then(
 	    (r)=>{
		if(r)
		    this._copy_anno_(anno);
		    this._set_commited_();
	    },
	    (e)=>{
		console.log(e);
	    }
	);
    }
}

Director.prototype._set_commited_=async function(disposed)
{
   await navigator.locks.request(
       this._lock_render,
       (lock)=>{
	   this._unset_loading();
	   let el=this._get_list_item(this._list_cursor_pos);
	   if(!el)
	       return null;
	   
	   if(disposed){
	       delete el.dataset.hasAnnotation;
	       this.element.caption.value='';
	       this._set_btn_inactive(this.element.btn.edit_dispose);
	   }
	   else{
	       el.dataset.hasAnnotation='true';
	       this._set_btn_active(this.element.btn.edit_dispose);
	   }
	   this._unset_anno_changed();
	   return el;
       }
   );
}

Director.prototype._do_paste_=async function()
{
    let anno=this._last_commit_anno;

    //
    // To enable the undo feature of textarea,
    // paste the value from the clipboard instead of rewriting it directly
    //
    await navigator.locks.request(
	this._lock_render,
	(lock)=>{
	    API.copy_anno(anno).then(
		(r)=>{
		    this.element.caption.focus();
		    API.paste();
		    this._set_anno_changed();
		},
		(e)=>{
		    console.log(e);
		}
	    );
	}
    );
}

Director.prototype._do_dispose=function()
{
    if(!this._current_image)
	return;
    
    let path=this._current_image.dataset.path;
    if(path==null)
	return;
    else
	path=decodeURI(path);
    
    let el=this._get_list_item(this._list_cursor_pos);
    if((!el) ||(!el.dataset.hasAnnotation))
	return;
    
    API.rm_anno(path).then(
 	(r)=>{
	    if(r)
		this._set_commited_(true);
	},
	(e)=>{
	    console.log(e);
	}
    );
}

Director.prototype._set_loading_=async function(args)
{
    await navigator.locks.request(
	this._lock_render,
	{ ifAvailable: true },
	(lock)=>{
	    this._erase_body(
		(args && args.type=='file') ? true : false,
		true
	    );
	    //if(args && args.type=='dir' && args.target)
	    //	this._set_cwd(args.target);
	    
	    this.element.loading_img.style.display='inline-block';
	}
    );
}
Director.prototype._unset_loading=function()
{
    this.element.loading_img.style.display='none';
}

Director.prototype._set_lock=function()
{
    this.element.lock.style.display='block';
    this.element.lock.setAttribute('tabindex','-1');
    this._set_loading_({type:'file'});
    this.element.lock.focus();
}
Director.prototype._unset_lock=function()
{
    this.element.lock.style.display='none';
    this._unset_loading();
    let r=this.element.lock.dataset.relatedTarget;
    if(r){
	let el=document.getElementById(r);
	delete this.element.lock.dataset.relatedTarget;
	if(el)
	    el.focus();
    }
    else
	this.element.filelist.focus();
}

Director.prototype._copy_anno_=async function(anno)
{
    await navigator.locks.request(
	this._lock_render,
	(lock)=>{
	    this._last_commit_anno=anno;
	    
	    let cls=this.element.btn.edit_paste.getAttribute('class')
	    cls=cls.replaceAll('fa-regular','fa-solid');
	    this.element.btn.edit_paste.setAttribute('class',cls);
	}
    );
    
    API.copy_anno(anno).then(
	(r)=>{},
	(e)=>{
	    console.log(e);
	}
    );
}

Director.prototype._set_config=function(c)
{
    if(this._config)
	Object.assign(this._config,c);
    else
	this._config=c;
}

window.onload=async function(event){
    document.director=new Director(await API.get_config());
    API.on_start_loading(
	document.director._set_loading_.bind(document.director)
    );

    document.director.cmd_dir_open();
};
window.onbeforeunload=function(event){
    document.director._do_commit();
}
