//
//
//
const API=window.extra.api;
const MAX_DIRNAME_LEN=64;
const EVENT_OVERWRITE_INTERVAL=3;
const INTERVAL_UNTIL_LOADING_SCREEN=10;

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

////////////////////////////////////////////////////////////////////////
//
// HTML dialog wrapper
//
function Dialog(base_element)
{
    this._elm={};
    if(!base_element)
	this._build_base();
    else{
	this._elm.base=base_element;
	this._elm.title=this._elm.base.getElementsByTagName('h1')[0];
	this._elm.msg=this._elm.base.getElementsByTagName('p')[0];
	this._elm.form=this._elm.base.getElementsByTagName('form')[0];
    }
    this._status=null;
    this._retval=null;

    this._elm.buttons=[];
    this._promise={};
}
Dialog.prototype.base_element=function()
{
    return this._elm.base;
}
Dialog.prototype.base_element=function()
{
    return this._elm.base;
}
Dialog.prototype.show=function(opts={})
{
    this._clear();
    this._build(opts);

    this._promise.body=new Promise(
	(resolve,reject)=>{
	    this._promise.resolve=resolve;
	    this._promise.reject=reject;
	    this._elm.base.showModal();
	    this._elm.buttons._autofocus.focus();
	    this._status='opend';
	}
    );
    
    return this._promise.body;
}

Dialog.prototype._build_base=function()
{
    this._elm.base=document.document.createElement('dialog');
    this._elm.title=document.document.createElement('h1');
    this._elm.msg=document.document.createElement('p');
    this._elm.form=document.document.createElement('form');
    this._elm.form.setAttribute('method','dialog');

    this._elm.base.appendChild(this._elm.title);
    this._elm.base.appendChild(this._elm.msg);
    this._elm.base.appendChild(this._elm.form);

    return this._elm.base;
}

Dialog.prototype._build=function(opts)
{
    let cls=opts.type||'info';
    this._elm.base.setAttribute('class',cls);
    
    if(opts.title==undefined){
	switch(cls){
	case 'question':
	    opts.title='Question';
	    break;
	case 'confirm':
	    opts.title='Confirmation';
	    break;
	case 'warn':
	    opts.title='Warning';
	    break;
	case 'error':
	    opts.title='Error';
	    break;
	default:
	    opts.title='Information';
	}
    }
    this._elm.title.textContent=opts.title;
    this._elm.msg.textContent=opts.message;
    
    let btns=opts.buttons||['OK'];
    let default_id=parseInt(opts.defaultId||0);
    let cancel_id=parseInt(opts.cancelId||0);
    for(let idx=0;idx<btns.length;idx++){
	let b=btns[idx];
	if(typeof(b)=='string')
	    b=[b,idx];
	else
	    b=Object.entries(b)[0];
	
	let el=document.createElement('button');
	el.dataset.idx=idx;
	el.setAttribute('type','button');
	el.setAttribute('formmethod','dialog');
	el.setAttribute('tabindex','0');
	if(idx==default_id){
	    el.setAttribute('autofocus','');
	    this._elm.buttons._autofocus=el;
	}
	el.textContent=b[0];
	el.value=b[1];
	if(idx==cancel_id)
	    this._retval=el.value;
	el.addEventListener(
	    "click",
	    (event)=>{
		this._status='confirmed';
		this._retval=el.value;
		this._elm.base.close();
	    }
	)
	el.addEventListener(
	    "keydown",
	    (event)=>{
		switch(event.key){
		case 'ArrowLeft':
		    this._move_lr(el,-1);
		    break;
		case 'ArrowRight':
		    this._move_lr(el,1);
		    break;
		}
	    }
	)
	
	this._elm.buttons.push(el);
	this._elm.form.appendChild(el);
    }
    
    this._elm.base.addEventListener(
	'close',
	this._on_close.bind(this),
	{once:true}
    );
    
    return this._elm.base;
}
Dialog.prototype._clear=function()
{
    this._elm.base.removeEventListener(
	'close',
	this._on_close.bind(this),
	{once:true}
    );

    while(this._elm.form.firstChild)
	this._elm.form.removeChild(this._elm.form.firstChild);
    this._elm.buttons.length=0;
    delete this._elm.buttons._autofocus;
    
    this._retval=null;
    this._status=null;
    delete this._promise.body;
    delete this._promise.resolve;
    delete this._promise.reject;
}
Dialog.prototype._on_close=function(event)
{
    if(this._status!='confirmed')
	this._status='canceled';
    
    if(this._promise.resolve)
	this._promise.resolve(this._retval);
}
Dialog.prototype._move_lr=function(el,pos)
{
    let i=parseInt(el.dataset.idx)+pos;
    if(i<0)
	i=this._elm.buttons.length+i;
    i=i%this._elm.buttons.length;

    this._elm.buttons[i].focus();
}
//
// end of Dialog
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//
// Writing UI Controller
//
function Writer(parent,config={})
{
    this._parrnt=parent;

    this._config={};
    this._set_config(config);
    
    this._lock_renderer='lock-renderer';
    this._lock_api='lock-api';

    this._global_event_listner=null;
    
    this.cwd=null;
    this._list_size=0;
    this._list_cursor_pos=null;
    this._current_image=null;
    this._is_editing=null;
    this._has_changed=false;
    this._last_commit_anno=null;
    this._win_close_action=null;
    
    //
    // object caches
    //
    this._elm={};
    this._elm.main_base=document.getElementById('main-base');
    this._elm.cwd=document.getElementById('cwd');
    this._elm.filelist=document.getElementById('filelist');
    this._elm.img_area=document.getElementById('image-area');
    this._elm.src_img=document.getElementById('target-image');
    //this._elm.loading_img=document.getElementById('loading-image');
    this._elm.caption=document.getElementById('caption');
    this._elm.dialog=document.getElementById('popup-dialog');
    this._elm.scrlk=document.getElementById('lock-screen');

    
    //
    // buttons
    //
    this._elm.btn={};
    this._elm.btn.list_open=document.getElementById('btn-list-open');
    this._elm.btn.list_rescan=document.getElementById('btn-list-rescan');

    this._elm.btn.edit_commit=document.getElementById('btn-edit-commit');
    this._elm.btn.edit_paste=document.getElementById('btn-edit-paste');
    this._elm.btn.edit_undo=document.getElementById('btn-edit-undo');
    this._elm.btn.edit_redo=document.getElementById('btn-edit-redo');
    this._elm.btn.edit_discard=document.getElementById('btn-edit-discard');
    this._elm.btn.edit_dispose=document.getElementById('btn-edit-dispose');
    
    this._edit_buttons=[
	this._elm.btn.edit_commit,
	this._elm.btn.edit_paste,
	this._elm.btn.edit_undo,
	this._elm.btn.edit_redo,
	this._elm.btn.edit_discard,
	this._elm.btn.edit_dispose
    ];

    this._dialog=new Dialog(this._elm.dialog);

    // size caches
    this._el_size={};

    this._add_listeners();

    this._apply_config();

    this._unset_anno_changed();
    this._elm.main_base.removeAttribute('disabled');
}

Writer.prototype.attach=function()
{
    this._global_event_listners.forEach((obj)=>{
	window.addEventListener(
	    obj.event,
	    obj.func,
	    obj.opt
	)
    },this);

    return this;
}
Writer.prototype.detach=function()
{
    this._global_event_listners.forEach((obj)=>{
	window.removeEventListener(
	    obj.event,
	    obj.func,
	    obj.opt
	)
    },this);

    return this;
}

Writer.prototype.cmd_dir_open=function(force)
{
    if(this._is_loading())
	return;

    if(!(force || this._is_btn_active(this._elm.btn.list_open)))
	return;
    
    this._do_dir_open(false);
}

Writer.prototype.cmd_dir_rescan=function()
{
    if(this._is_loading())
	return;

    if(!this._is_btn_active(this._elm.btn.list_rescan))
	return;
    
    this._do_dir_open(true);
}

Writer.prototype.cmd_list_up=function()
{
    if(this._is_loading())
	return;

    if(!this._list_size)
	return;
    
    if(this._list_cursor_pos==null)
	this._list_cursor_pos=1;
    
    this._do_image_open(
	this._list_cursor_pos-1,
	this._elm.filelist
    );
}

Writer.prototype.cmd_list_down=function()
{
    if(this._is_loading())
	return;

    if(!this._list_size)
	return;
    
    if(this._list_cursor_pos==null)
	this._list_cursor_pos=-1;
    
    this._do_image_open(
	this._list_cursor_pos+1,
	this._elm.filelist
    );
}

Writer.prototype.cmd_edit_start=function()
{
    if(this._is_loading())
	return;

    if(!this._list_size)
	return;

    let el=this._elm.caption;
    let len=el.value.length;
    el.focus();
    el.setSelectionRange(len,len);
}

Writer.prototype.cmd_edit_copy_anno=function()
{
    if(this._is_loading())
	return;

    this._lock_with_loading((lock)=>{
	if((!this._list_size)||(this._list_cursor_pos==null))
	    return Promise.resolve();
    
	let el=this._get_list_item(this._list_cursor_pos);
	if((!el) || (!el.dataset.hasAnnotation))
	    return Promise.resolve();
	
	let anno=this._elm.caption.value;
	if(!anno)
	    return Promise.resolve();

	return this._copy_anno(anno);
    });
}

Writer.prototype.cmd_edit_clear_copied_anno=function()
{
    if(this._is_loading())
	return;

    this._last_commit_anno=null;

    let cls=this._elm.btn.edit_paste.getAttribute('class')
    cls=cls.replaceAll('fa-solid','fa-regular');
    this._elm.btn.edit_paste.setAttribute('class',cls)
}


Writer.prototype.cmd_edit_commit=function()
{
    if(this._is_loading())
	return;

    this._do_commit().then((r)=>{
	this._elm.filelist.focus();
    });
}

Writer.prototype.cmd_edit_paste_tlc=function()
{
    if(this._is_loading())
	return;

    if(!this._last_commit_anno)
	return;
    
    this._do_paste_();
}

Writer.prototype.cmd_edit_undo=function()
{
    if(this._is_loading())
	return;

    API.undo().then(()=>{
	this._elm.caption.focus();
    });
}

Writer.prototype.cmd_edit_redo=function()
{
    if(this._is_loading())
	return;

    API.redo().then(()=>{
	this._elm.caption.focus();
    });
}

Writer.prototype.cmd_edit_discard=function()
{
    if(this._is_loading())
	return;

    this._do_discard();
}

Writer.prototype.cmd_edit_dispose=function()
{
    if(this._is_loading())
	return;

    this._do_dispose().then((r)=>{
	this._elm.filelist.focus();
    }).catch((e)=>{
	this._elm.filelist.focus();
    });
}

Writer.prototype._lock_with_loading=function(promise,lock)
{
    if(lock)
	return promise(lock);
    else{
	let timer;
	return navigator.locks.request(
	    this._lock_api,
	    (lock)=>{
		this._set_loading();
		return promise(lock);
	    }
	).finally((r)=>{
	    this._unset_loading();
	});
    }
}

Writer.prototype._add_listeners=function()
{
    //
    // buttons
    //
    this._elm.btn.list_open.addEventListener(
	'click',
	this.cmd_dir_open.bind(this));
    this._elm.btn.list_rescan.addEventListener(
	'click',
	this.cmd_dir_rescan.bind(this));

    this._elm.btn.edit_commit.addEventListener(
	'click',
	this.cmd_edit_commit.bind(this));
    this._elm.btn.edit_paste.addEventListener(
	'click',
	this.cmd_edit_paste_tlc.bind(this));
    this._elm.btn.edit_undo.addEventListener(
	'click',
	this.cmd_edit_undo.bind(this));
    this._elm.btn.edit_redo.addEventListener(
	'click',
	this.cmd_edit_redo.bind(this));
    this._elm.btn.edit_discard.addEventListener(
	'click',
	this.cmd_edit_discard.bind(this));
    this._elm.btn.edit_dispose.addEventListener(
	'click',
	this.cmd_edit_dispose.bind(this));
    //
    // add short cut key description to tool tip
    //
    this._add_text_to_title(
	this._elm.btn.list_open,
	'Ctrl-o'
    );
    this._add_text_to_title(
	this._elm.btn.list_rescan,
	'F5 or Ctrl-r'
    );
    this._add_text_to_title(
	this._elm.btn.edit_commit,
	'Ctrl-RET'
    );
    this._add_text_to_title(
	this._elm.btn.edit_paste,
	'Ctrl-Shift-v'
    );
    this._add_text_to_title(
	this._elm.btn.edit_undo,
	'Ctrl-z'
    );
    this._add_text_to_title(
	this._elm.btn.edit_redo,
	'Ctrl-y'
    );
    this._add_text_to_title(
	this._elm.btn.edit_discard,
	'Ctrl-Shift-d'
    );
    this._add_text_to_title(
	this._elm.btn.edit_dispose,
	'Ctrl-DEL'
    );
    

    //
    // cwd area
    //
    this._elm.cwd.addEventListener(
	'click',
	this.cmd_dir_open.bind(this)
    );
    this._elm.filelist.addEventListener(
	'focus',
	(event)=>{
	    this._set_edit_btn_inactive();
	}
   );// insurance in case the blur handler of the textarer is skipped

    //
    // filelist keys
    //
    this._elm.filelist.addEventListener(
	'keydown',
	(event)=>{
	    if(this._is_loading())
		return;
	    
	    switch(event.key){
	    case 'c':
		if(event.ctrlKey){
		    event.preventDefault();
		    this.cmd_edit_copy_anno();
		}
		break;
	    case 'C':
		if(event.ctrlKey){
		    event.preventDefault();
		    this.cmd_edit_clear_copied_anno();
		}
		break;
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
		if(event.shiftKey)
		    this.cmd_dir_rescan()
		else
		    this.cmd_dir_open()
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
    this._elm.filelist.setAttribute(
	'title',
	`[\u2191]: List Up
[\u2193]: List Down
[\u2192] or [RET] or [TAB]: Start Editing
[\u2190]: Select Folder
[Shift+\u2190]: Rescan
[Ctrl-c]: Copy the Existing Caption
[Ctrl-Shft-c]: Clear the Copied Caption
[Ctrl-DEL]: Dispose the Existing Caption`
   );
    
   this._elm.filelist.addEventListener(
	'focus',
       (event)=>{
	   this._set_edit_btn_inactive();
       } 
   );// insurance in case the blur handler of the textarer is skipped
   this._elm.filelist.addEventListener(
	'blur',
       (event)=>{
	   if((!event.relatedTarget)||
	      (event.relatedTarget==this._elm.caption &&
	       !this._current_image))
	       this._elm.filelist.focus();
       }
   );

    
    //
    // text-area
    //
    const non_focus_relateds=this._edit_buttons.concat([this._elm.scrlk]);
    this._elm.caption.addEventListener(
	'focus',
	(event)=>{
	    if(this._current_image){
		this._set_edit_btn_active();
		this._edit_start();
	    }
	    else
		this._elm.filelist.focus();
	}
    );

    this._elm.caption.addEventListener(
	'blur',
	(event)=>{
	    if(document.activeElement==event.target)
		return;
	    if(this._is_loading()){
		if(this._is_editing){
		    //
		    // Skip the confirmation dialog and just clean up
		    //
		    this._onEditEnd(
			()=>this._set_edit_btn_inactive(),
			Promise.resolve()
		    );
		}
		return;
	    }

	    if(this._current_image){
		if(!(
		    this._edit_buttons.includes(
			event.relatedTarget
		    )||this._dialog._elm.buttons.includes(
			event.relatedTarget
		    )||(event.relatedTarget==null && 
			this._dialog._status=='opend')
		)){
		    if(event.relatedTarget==this._elm.scrlk){
			this._elm.scrlk.dataset.relatedTarget=
			    this._elm.caption.id;
			return;
		    }
		    
		    this._onEditEnd(
			()=>{
			    this._set_edit_btn_inactive();
			    this._elm.filelist.focus();
			}
		    );
		}
	    }
	}
    );

    const CtrlUpDown=(step,promise)=>{
	promise.then((r)=>{
	    this._do_image_open(
		this._list_cursor_pos+step,
		this._elm.caption
	    ).then((r)=>{
		this._elm.caption.focus();
		return r;
	    })
	});
    }
    this._elm.caption.addEventListener(
	'keydown',
	(event)=>{
	    switch(event.key){
	    case 'ArrowUp':
		if(event.ctrlKey){
		    event.preventDefault();
		    this._onEditEnd(CtrlUpDown.bind(this,-1));
		}
		break;
	    case 'ArrowDown':
		if(event.ctrlKey){
		    event.preventDefault();
		    this._onEditEnd(CtrlUpDown.bind(this,1));
		}
		break;
	    case 's':
		if(event.ctrlKey){
		    event.preventDefault();
		    this._do_commit().then(
			(r)=>event.target.focus()
		    );
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
		let el=this._elm.caption;
		if(el.selectionStart!=el.selectionEnd)
		    el.selectionEnd=el.selectionStart
		else if(this._has_changed)
		    this._do_discard().then(
			(r)=>event.target.focus()
		    )
		else
		    this._elm.filelist.focus();
		break;
	    default:
		//console.log(event);
	    }
	}
    );
    this._elm.caption.setAttribute(
	'title',
	`[Ctrl-s]: Commit and Keep Editing
[Ctrl-RET]: Commit
[ESC]: Discard
[TAB]: Exit Editing
[Ctrl+\u2191]: Edit the image above on the list
[Ctrl+\u2193]: Edit the image below on the list
`
    );
    
    this._buid_global_event_listners();
}

Writer.prototype._buid_global_event_listners=function()
{
    // declaring as oneshot event for avoiding re-entrance
    const resize_func=(event)=>{
	    this._resize_();
	    window.addEventListener(
		'resize',
		resize_func,
		{once:true}
	    );
    };

    this._global_event_listners=[
	{
	    event:'keydown',
	    func:(event)=>{
		if(this._is_loading())
		    return;
		
		switch(event.key){
		case 'Delete':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_edit_dispose();
		    }
		    break;
		case 'Enter':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_edit_commit();
		    }
		    break;
		case 'V':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_edit_paste_tlc();
		    }
		    break;
		case 'D':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_edit_discard();
		    }
		    break;
		case 'o':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_dir_open();
		    }
		    break;
		case 'r':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_dir_rescan();
		    }
		    break;
		case 'F5':
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_dir_rescan();
		    break;
		case 'L':
		    if(event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this._toggle_screenlock();
		    }
		    break;
		default:
		    //console.log([event,event.key.charCodeAt()]);
		}
	    },
	    opt:null
	},
	{
	    event:'resize',
	    func:resize_func,
	    opt:{once:true}
	},
	{
	    event:'beforeunload',
	    func:(event)=>{
		if(!(this._current_image && this._has_changed))
		    return;
		
		event.preventDefault();
		this._edit_end().then((x)=>{
		    if(x=='continue'){
			event.preventDefault();
			event.returnValue=false;
			this._elm.caption.focus();
			return event;
		    }
		    else{
			this._elm.filelist.focus();
			//
			// I want to know more smart way....
			//
			const callback=
			      this._win_close_action ? window.close : API.reload;
			setTimeout(
			    callback,
			    EVENT_OVERWRITE_INTERVAL
			);
		    }
		})
	    },
	    opt:null
	},
    ];
}


Writer.prototype._apply_config=function(cfg=this._config)
{
    if(cfg.spellcheck)	
	this._elm.caption.removeAttribute('spellcheck');
    else
	this._elm.caption.setAttribute('spellcheck','false');
    
    if(cfg.autocomplete)	
	this._elm.caption.removeAttribute('autocomplete');
    else
	this._elm.caption.setAttribute('autocomplete','off');

}

Writer.prototype._add_text_to_title=function(el,text)
{
    let title=(el.getAttribute('title')||'')+' ['+text+']';
    el.setAttribute('title',title.trim());
}

Writer.prototype._resize_=async function()
{
    let cw,ch;
    await navigator.locks.request(
	this._lock_renderer,
	{ ifAvailable: true },
	(lock)=>{
	    [cw,ch]=this._fit_image();
	}
    );
    
    return true;
}

Writer.prototype._fit_image=function()
{
    if(!this._el_size.image_area_pad_w)
	this._el_size.image_area_pad_w=parseInt(
	    window.getComputedStyle(this._elm.img_area)['padding-left']
	)+parseInt(
	    window.getComputedStyle(this._elm.img_area)['padding-right']
	);
    if(!this._el_size.image_area_pad_h)
	this._el_size.image_area_pad_h=parseInt(
	    window.getComputedStyle(this._elm.img_area)['padding-top']
	)+parseInt(
	    window.getComputedStyle(this._elm.img_area)['padding-bottom']
	);
    
    const Pw=this._elm.img_area.offsetWidth;
    const Ph=this._elm.img_area.offsetHeight;
    
    let cw=Pw-this._el_size.image_area_pad_w;
    let ch=Ph-this._el_size.image_area_pad_h;
    
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

Writer.prototype._rendering=function(imagelist,keep_image)
{
    if(!imagelist){
	this._set_list_btn_active();
	return;
    }

    if(this.cwd==imagelist.cwd)
	keep_image=true;
    
    let last_anno_idx=null;
    this._erase_body(false,keep_image);
    
    this._set_cwd(imagelist.cwd);
    last_anno_idx=this._build_filelist(imagelist);
    
    this._fit_image();
    
    if(keep_image && this._list_cursor_pos!=null){
	let el=this._get_list_item(this._list_cursor_pos);
	el.focus();
    }
    else if(this._list_size){
	this._do_image_open.bare.call(
	    this,
	    last_anno_idx==null ? 0 : last_anno_idx
	);
	this._elm.filelist.focus();
    }

    this._set_list_btn_active();
    this._elm.filelist.focus();
}

Writer.prototype._set_list_btn_active=function()
{
    this._set_btn_active(this._elm.cwd);
    this._set_btn_active(this._elm.btn.list_open);
    this._set_btn_active(this._elm.btn.list_rescan);
}


Writer.prototype._erase_body=function(keep_list,keep_img)
{
    if(!keep_img)
	this._close_current_image();
    
    if(keep_list)
	return;
    
    //
    // clear header
    //
    this.cwd=null;
    this._elm.cwd.innerText='';
    this._elm.cwd.removeAttribute('title');
    
    //
    // clear list
    //
    while(this._elm.filelist.firstChild)
	this._elm.filelist.removeChild(this._elm.filelist.firstChild);
    this._list_cursor_pos=null;
}

Writer.prototype._set_cwd=function(cwd)
{
    this.cwd=cwd;
    let str=cwd;
    let len=str.length;
    if(len>MAX_DIRNAME_LEN)
	str='...'+str.substring(len-MAX_DIRNAME_LEN-3);

    this._elm.cwd.textContent=str;
    this._elm.cwd.setAttribute('title',escapeHTML(cwd));
}

Writer.prototype._build_filelist=function(imagelist)
{
    let old_path=null;
    if(this._current_image)
	old_path=this._current_image.dataset.path;

    let idx=0,last_anno_idx=null;
    if(imagelist.images && imagelist.images.length>0){
	this._list_size=imagelist.images.length;
	
	imagelist.images.forEach(function(obj){
	    let li=document.createElement('li');
	    li.textContent=decodeURI(obj.basename);

	    li.dataset.path=obj.path;
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
	    
	    li.addEventListener(
		'click',
		()=>{
		    if(this._is_loading())
			return;
		    this._do_image_open(idx,false)
		}
	    );
	    
	    this._elm.filelist.appendChild(li);
	    
	    idx+=1;
	},this);
	this._set_btn_active(this._elm.caption);
    }
    else{
	let li=document.createElement('li');
	li.setAttribute('class','no-image');
	this._elm.filelist.appendChild(li);
	this._set_btn_inactive(this._elm.caption);
	this._list_size=0;
    }

    return last_anno_idx;
}

Writer.prototype._edit_start=function()
{
    if(!this._current_image)
	return;
    
    this._is_editing=true;
    if(this._has_changed)
	this._set_anno_changed()
    else{
	this._elm.caption.addEventListener(
	    'input',
	    this._set_anno_changed.bind(this),
	    {once:true}
	);
    }
}
Writer.prototype._edit_end=function()
{
    if(!(this._current_image && this._has_changed))
	return Promise.resolve(null);
    
    return (async ()=>{
	if(this._config.auto_commit)
	    return 1;
	else{
	    return await this._dialog.show({
		title:'Confirmation',
		type:'question',
		message:`Editing is in progress.
How do you process them?`,
		buttons:['Keep Editing','Commit','Discard'],
		defaultId:0,
	    })
	}
    })().then(
	(x)=>{
	    switch(parseInt(x)){
	    case 1:
		return this._do_commit();
		break;
	    case 2:
		return this._do_discard();
		break;
	    default:
		return Promise.resolve('continue');
	    }
	}
    );
}

//
// _edit_end wrapper
//
Writer.prototype._onEditEnd=function(callback,promise=this._edit_end())
{
    return promise.then((x)=>{
	let p=Promise.resolve(x);
	if(x=='continue'){
	    // Need a little bit moment to refocus
	    setTimeout(()=>{
		this._elm.caption.focus()
	    },EVENT_OVERWRITE_INTERVAL);
	}
	else{
	    this._is_editing=false;
	    callback(p);
	}
	return p;
    }).catch((e)=>{
	let p=Promise.resolve(e);
	this._is_editing=false;
	callback(p);
	return p;
    });
}

Writer.prototype._idx2path=function(idx)
{
    let el=this._elm.filelist.getElementsByTagName('li')[idx];
    if(el)
	return el.dataset.path;
    else
	return el;
}

Writer.prototype._show_image=function(idx,obj)
{
    this._close_current_image();
    
    this._set_list_select(idx);
    let el=this._elm.src_img;
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
	this._set_btn_active(this._elm.btn.edit_dispose);
    else
	this._set_btn_inactive(this._elm.btn.edit_dispose);
}

Writer.prototype._set_anno=function(anno,event)
{
    let el=this._elm.caption;
    if(anno)
	el.value=anno;
    else
	el.value='';
    
    this._unset_anno_changed();
}

Writer.prototype._close_current_image=function()
{
    
    if(!this._current_image)
	return;
    
    this._elm.caption.value='';
    this._unset_anno_changed();
    
    this._unset_list_select(this._current_image.dataset.idx);
    this._current_image.style.display='none';
    this._current_image=null;
}

Writer.prototype._get_list_item=function(idx)
{
    return this._elm.filelist.getElementsByTagName('li')[parseInt(idx)];
}
Writer.prototype._set_list_select=function(idx)
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
Writer.prototype._unset_list_select=function(idx)
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
Writer.prototype._set_anno_changed=function()
{
    this._has_changed=true;
    this._set_btn_active(this._elm.btn.edit_commit);
    this._set_btn_active(this._elm.btn.edit_undo);
    this._set_btn_active(this._elm.btn.edit_redo);
    this._set_btn_active(this._elm.btn.edit_discard);
}
Writer.prototype._unset_anno_changed=function()
{
    let c=this._has_changed;
    this._has_changed=false;
    
    this._set_btn_inactive(this._elm.btn.edit_commit);
    this._set_btn_inactive(this._elm.btn.edit_undo);
    this._set_btn_inactive(this._elm.btn.edit_redo);
    this._set_btn_inactive(this._elm.btn.edit_discard);
    
    this._elm.caption.removeEventListener(
	'input',
	this._set_anno_changed.bind(this),
	{once:true}
    );
    
    return c;
}
Writer.prototype._set_edit_btn_active=function()
{
    if(this._last_commit_anno)
	this._set_btn_active(this._elm.btn.edit_paste);
    
    //
    // The CSS :focus pseudo-class will not work because the textarea
    // loses focus when it is disabled.
    // Therefore, while editing, we will change the text area's class
    // so that even when it is disabled, we can use the class selector
    // to maintain its appearance.
    //
    this._elm.caption.className='on';

}    
Writer.prototype._set_edit_btn_inactive=function()
{
    this._elm.caption.className='off';

    // reject dispose button
    this._edit_buttons.filter(
	(x)=>x!=this._elm.btn.edit_dispose
    ).forEach((obj)=>{
	if(obj!=this._elm.btn.edit_dispose)
	    this._set_btn_inactive(obj);
    });
} 

Writer.prototype._set_btn_active=function(obj)
{
    obj.removeAttribute('disabled');
}
Writer.prototype._set_btn_inactive=function(obj)
{
    obj.setAttribute('disabled','');
}
Writer.prototype._is_btn_active=function(obj)
{
    return obj.getAttribute('disabled')==null;
}
Writer.prototype._set_all_inactive=function()
{
    this._set_btn_inactive(this._elm.cwd);
    Object.values(this._elm.btn).forEach((el)=>{
	this._set_btn_inactive(el);
    });
}

Writer.prototype._do_dir_open=function(is_rescan)
{
    let promise=Promise.resolve(null);
    let editing=false
    if(this._has_changed){
	promise=this._edit_end();
	editing=true;
    }

    const dir=is_rescan ? this.cwd : null;
    // for testing, FIXME
    if(!is_rescan)
	document.getElementById('writer').className='dodge';
    //
    
    const callback=()=>{
	this._set_all_inactive();
	this._lock_with_loading(
	    (lock)=>API.open_dir(dir).then((result)=>{
		this._rendering(result,is_rescan);
		return Promise.resolve('dir-open');
	    }).then(()=>{
		// for testing, FIXME
		if(!is_rescan)
		    document.getElementById('writer').className='none';
		//
		if(editing)
		    this._elm.caption.focus();
		return Promise.resolve('dir-open');
	    }).catch((e)=>{
		console.log(e);
		if(is_rescan)
		    return this._do_dir_open(false);
		else
		    return Promise.reject('dir-open');
	    })
	);
    }
    this._onEditEnd(
	callback.bind(this),
	promise
    );
}

Writer.prototype._do_image_open=function(idx,focus_element)
{
    return this._lock_with_loading(
	(lock)=>this._do_image_open.bare.call(this,idx).then(
	    (r)=>{
		if(focus_element?.focus)
		    focus_element.focus();
		else
		    this._elm.caption.focus();
		
		return r;
	    }
	)
    );
}
Writer.prototype._do_image_open.bare=function(idx)
{
    let path=this._idx2path(idx);
    if(!path)
	return Promise.resolve();
    
    return API.open_img(path).then(
	(result)=>{
	    if(result){
		this._show_image(idx,result);
		return Promise.resolve('open-img');
	    }
	    else
		return Promise.reject('open-img');
	},
	(e)=>console.log(e)
    );
}

Writer.prototype._do_commit=function()
{
    return this._lock_with_loading(
	(lock)=>this._do_commit.bare.call(this)
    );
}
Writer.prototype._do_commit.bare=function(path)
{
    if(!path){
	path=this._current_image?.dataset?.path;
	if(!path)
	    return Promise.resolve();
    }
    
    let anno=this._elm.caption?.value;
    if(anno){
	return API.write_anno(path,anno).then(
 	    (r)=>{
		if(r){
		    this._copy_anno(anno);
		    this._set_anno_mark();
		}
		return Promise.resolve('commit');
	    },
	    (e)=>{
		console.log(e);
		return Promise.reject('commit');
	    }
	);
    }
    else{
	return this._do_dispose.bare.call(this,path);
    }
}


Writer.prototype._do_discard=function()
{
    return this._lock_with_loading(
	(lock)=>this._do_discard.bare.call(this)
    );
}
Writer.prototype._do_discard.bare=function(path)
{
    if(!path){
	path=this._current_image?.dataset?.path;
	if(!path)
	    return Promise.resolve();
    }
    
    return API.read_anno(path).then(
	(anno)=>{
	    this._set_anno(anno);
	    return Promise.resolve('discard');
	}
    ).catch(
	(e)=>{
	    console.log(e)
	    return Promise.reject('discard');
	}
    );
}


Writer.prototype._do_dispose=function()
{
    return this._lock_with_loading(
	(lock)=>this._do_dispose.bare.call(this)
    );
}
Writer.prototype._do_dispose.bare=function(path)
{
    if(!path){
	path=this._current_image?.dataset.path;
	if(path==null)
	    return Promise.resolve();
    }
    
    let el=this._get_list_item(this._list_cursor_pos);
    if((!el) ||(!el.dataset.hasAnnotation))
	return Promise.resolve();
 
    let p=this._config.dispose_without_confirm ? Promise.resolve('1') :
	this._dialog.show({
	    type:'confirm',
	    message:'Are you sure you want to dispose the saved caption?',
	    buttons:['Cancel','OK'],
	    defaultId:0
	});
    
    return p.then((x)=>{
	if(x=='1'){
	    return API.rm_anno(path).then(
 		(r)=>{
		    if(r){
			this._set_anno_mark(true);
			this._unset_anno_changed();
		    }
		    return Promise.resolve('dispose');
		},
		(e)=>{
		    console.log(e);
		    return Promise.reject('dispose');
		}
	    );
	}
	else
	    return this._do_discard.bare.call(this,path);
    });
}

Writer.prototype._set_anno_mark=function(disposed)
{
    let el=this._get_list_item(this._list_cursor_pos);
    if(!el)
	return;

    if(disposed){
	delete el.dataset.hasAnnotation;
	this._elm.caption.value='';
	this._set_btn_inactive(this._elm.btn.edit_dispose);
    }
    else{
	el.dataset.hasAnnotation='true';
	this._set_btn_active(this._elm.btn.edit_dispose);
    }
    this._unset_anno_changed();
}

Writer.prototype._do_paste_=async function()
{
    if(!this._is_editing)
	return Promise.resolve(null);
    
    let anno=this._last_commit_anno;

    //
    // To enable the undo feature of textarea,
    // paste the value from the clipboard instead of rewriting it directly
    //
    return API.copy_anno(anno).then(
	(r)=>{
	    this._elm.caption.focus();
	    return API.paste().then(
		(r)=>{
		    this._set_anno_changed();
		    return Promise.resolve('paste');
		},
		(e)=>e
	    );
	},
	(e)=>console.log(e)
    );
}

Writer.prototype._copy_anno=function(anno)
{
    this._last_commit_anno=anno;
    
    let cls=this._elm.btn.edit_paste.getAttribute('class')
    cls=cls.replaceAll('fa-regular','fa-solid');
    this._elm.btn.edit_paste.setAttribute('class',cls);
    
    return API.copy_anno(anno).then(
	(r)=>Promise.resolve('copy'),
	(e)=>{
	    console.log(e);
	    return Promise.reject('copy');
	}
    );
}

Writer.prototype._set_config=function(c)
{
    if(this._config)
	Object.assign(this._config,c);
    else
	this._config=c;
}


Writer.prototype._show_error=function(args)
{
    this._dialog.show({
	type:'error',
	title:args.title,
	message:args.message
    })
}

Writer.prototype._set_loading=function(args)
{
    this._elm.main_base.disabled=true;

    //
    // Loading screen is shown with a slight delay
    //
    this._elm.scrlk.dataset.timerId=setTimeout(
	()=>this._elm.scrlk.className='loading',
	INTERVAL_UNTIL_LOADING_SCREEN
    );
}
Writer.prototype._unset_loading=function()
{
    clearTimeout(this._elm.scrlk.dataset.timerId);
    delete this._elm.scrlk.dataset.timerId;
    this._elm.scrlk.className='none';
    
    this._elm.main_base.removeAttribute('disabled');
}
Writer.prototype._is_loading=function()
{
    return this._elm.main_base.disabled;
}


Writer.prototype._set_screenlock=function()
{
    document.getElementById('lock-message').textContent=
	this._config.lockscreen_messgae||'[Ctrl-Shift-l] to unlock';

    document.getElementById('lock-bottom').textContent=
	`${this._config.appInfo.name} ${this._config.appInfo.version}
\u00a9 ${this._config.appInfo.year} by ${this._config.appInfo.author}`;

    this._elm.scrlk.setAttribute('tabindex','-1');
    this._elm.scrlk.className='locking';
    this._elm.scrlk.focus();
}
Writer.prototype._unset_screenlock=function()
{
    this._elm.scrlk.className='none';
    this._elm.scrlk.removeAttribute('tabindex');
    let r=this._elm.scrlk.dataset.relatedTarget;
    if(r){
	let el=document.getElementById(r);
	delete this._elm.scrlk.dataset.relatedTarget;
	if(el)
	    el.focus();
    }
    else
	this._elm.filelist.focus();
}
Writer.prototype._toggle_screenlock=function()
{
    if(this._elm.scrlk.className=='locking')
	this._unset_screenlock();
    else
	this._set_screenlock();
}
//
// end of Writer
//
////////////////////////////////////////////////////////////////////////

window.onload=function(event){
    API.get_config().then(
	(c)=>document.director=new Writer(null,c)
    ).then((r)=>{
	document.director.attach();
	API.reg_on_error_handler(
	    document.director._show_error.bind(document.director)
	);
	API.reg_on_close_handler(
	    ()=>{
		document.director._win_close_action=true;
	    }
	);
	document.director.cmd_dir_open();
    });
}
