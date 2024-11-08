//
//
//
const API=window.extra.api;
const INTERVAL_UNTIL_LOADING_SCREEN=10;

////////////////////////////////////////////////////////////////////////
//
// HTML dialog wrapper
//
function Dialog(base_el)
{
    this._elm={};
    if(!base_el)
	this._build_base();
    else{
	this._elm.base=base_el;
	this._elm.title=this._elm.base.getElementsByTagName('h1')[0];
	this._elm.msg=this._elm.base.getElementsByTagName('p')[0];
	this._elm.form=this._elm.base.getElementsByTagName('form')[0];
    }
    this._status=null;
    this._retval=null;

    this._elm.buttons=[];
    this._promise={};

    Object.defineProperty(this,'base_element',{
	get(){ return this._elm.base; }
    });
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
// Loading and Lock screen
// It will be blocking all user interactions.
//
function ScreenGuard(base_el,config={})
{
    this._config={};
    this.set_config(config);
    
    this._elm={};
    if(!base_el)
	this._build_base();
    else{
	this._elm.base=base_el;
	this._elm.message=document.getElementById('lock-message');
	this._elm.footnote=document.getElementById('lock-bottom');
    }
    Object.defineProperty(this,'base_element',{
	get(){ return this._elm.base; }
    });
    
    this._timer=null;
    this._related_target=null;

    this._loading_start_hooks=[];
    this._loading_stop_hooks=[];

    this._is_active=null;
    Object.defineProperty(this,'is_active',{
	get(){ return this._is_active; }
    });
    
    this._elm.base.addEventListener(
	'focus',
	(e)=>{
	    if(!this._related_target)
		this._related_target=e.relatedTarget;
	}
    );
}

ScreenGuard.prototype.set_config=function(cfg)
{
    this._config.message=cfg.lockscreen_message;
    this._config.footnote=cfg.lockscreen_footnote;
}


//
// on start/stop hooks operations
//
ScreenGuard.prototype.add_loading_start_hook=function(target,callback)
{
    this._loading_start_hooks.push({target:target,func:callback,active:true});
}
ScreenGuard.prototype.add_loading_stop_hook=function(target,callback)
{
    this._loading_stop_hooks.push({target:target,func:callback,active:true});
}
ScreenGuard.prototype.add_loading_hook=function(target,on_start,on_stop)
{
    if(on_start)
	this.add_loading_start_hook(target,on_start);
    if(on_stop)
	this.add_loading_stop_hook(target,on_stop);
}

ScreenGuard.prototype.remove_loading_start_hook=function(target)
{
    let idx=this._loading_start_hooks.findIndex((x)=>x.target==target);
    if(idx>=0)
	this._loading_start_hooks.splice(idx,1);
}
ScreenGuard.prototype.remove_loading_stop_hook=function(target)
{
    let idx=this._loading_stop_hooks.findIndex((x)=>x.target==target);
    if(idx>=0)
	this._loading_stop_hooks.splice(idx,1);
}
ScreenGuard.prototype.remove_loading_hook=function(target)
{
    this.remove_loading_start_hook(target);
    this.remove_loading_stop_hook(target);
}

ScreenGuard.prototype.activate_loading_start_hook=function(target)
{
    this._loading_start_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=true;
    });
}
ScreenGuard.prototype.activate_loading_stop_hook=function(target)
{
    this._loading_stop_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=true;
    });
}
ScreenGuard.prototype.activate_loading_hook=function(target)
{
    this.activate_loading_start_hook(target);
    this.activate_loading_stop_hook(target);
}

ScreenGuard.prototype.suspend_loading_start_hook=function(target)
{
    this._loading_start_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=false;
    });
}
ScreenGuard.prototype.suspend_loading_stop_hook=function(target)
{
    this._loading_stop_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=false;
    });
}
ScreenGuard.prototype.suspend_loading_hook=function(target)
{
    this.suspend_loading_start_hook(target);
    this.suspend_loading_stop_hook(target);
}

ScreenGuard.prototype.toggle_loading_start_hook=function(target)
{
    this._loading_start_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=!x.active;
    });
}
ScreenGuard.prototype.toggle_loading_stop_hook=function(target)
{
    this._loading_stop_hooks.forEach((x)=>{
	if(x.target==target)
	    x.active=!x.active;
    });
}
ScreenGuard.prototype.toggle_loading_hook=function(target)
{
    this.toggle_loading_start_hook(target);
    this.toggle_loading_stop_hook(target);
}


ScreenGuard.prototype.set_related_target=function(obj)
{
    this._related_target=obj;
}
ScreenGuard.prototype.set_loading=function()
{
    this._is_active=true;
    
    this._loading_start_hooks.forEach((o)=>{
	if(o.active)
	    o.func()
    });
    
    //
    // Loading screen is shown with a slight delay
    //
    this._timer=setTimeout(
	()=>this._elm.base.className='loading',
	INTERVAL_UNTIL_LOADING_SCREEN
    );
}
ScreenGuard.prototype.unset_loading=function()
{
    clearTimeout(this._timer);
    this._timer=null;
    this._elm.base.className='none';

   this._loading_stop_hooks.forEach((o)=>{
	if(o.active)
	    o.func()
   });
    this._is_active=false;
}
ScreenGuard.prototype.set_screenlock=function()
{
    this._is_active=true;
    
    this._elm.message.textContent=this._config.message;
    this._elm.footnote.textContent=this._config.footnote;
    
    this._elm.base.setAttribute('tabindex','-1');
    this._elm.base.className='locking';
    
    this._elm.base.focus();
    return this._elm.base;
}
ScreenGuard.prototype.unset_screenlock=function()
{
    this._elm.base.className='none';
    this._elm.base.removeAttribute('tabindex');

    this._is_active=false;
    
    let el=this._related_target;
    this._related_target=null;

    if(el?.focus)
	el.focus();

    return el
}
ScreenGuard.prototype.toggle_screenlock=function()
{
    if(this._elm.base.className=='locking')
	return this.unset_screenlock();
    else
	return this.set_screenlock();
}

ScreenGuard.prototype._build_base=function()
{
    this._elm.base=document.document.createElement('div');
    this._elm.base.id='lock-screen'
    this._elm.className='none'
    
    let p=document.document.createElement('p');
    p.id='lock-loading';
    let span=document.document.createElement('span');
    span.id='loading-image';
    span.className='fa-solid fa-spinner';
    p.appendChild(span)
    this._elm.base.appendChild(p);
    
    this._elm.message=document.document.createElement('p');
    this._elm.message.id='lock-message';
    this._elm.base.appendChild(this._elm.message);
    
    this._elm.footnote=document.document.createElement('p');
    this._elm.footnote.id='lock-bottom';
    this._elm.base.appendChild(this._elm.footnote);
}
//
// end of ScreenGuard
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//
// Screen Director
//
Director=function(config={})
{
    this._config={};
    this._set_config(config);

    this._lock_api='lock-api';

    this._dialog=new Dialog(document.getElementById('popup-dialog'));
    Object.defineProperty(this,'dialog',{
	get(){ return this._dialog; }
    });
    
    this._screen_guard=new ScreenGuard(
	document.getElementById('lock-screen'),
	{
	    lockscreen_message:
	    this._config.lockscreen_messgae||'[Ctrl-Shift-l] to unlock',
	    lockscreen_footnote:
	    `${this._config.appInfo.name} ${this._config.appInfo.version}
\u00a9 ${this._config.appInfo.year} by ${this._config.appInfo.author}`
	}
    );
    Object.defineProperty(this,'screen_guard',{
	get(){ return this._screen_guard; }
    });
    
    
    this._filer=new Filer(this,this._config);
    this._writer=new Writer(this,this._config);
    this._writer.attach();

    this._writer_last_wd=null;
}

Director.prototype.lock_with_loading=function(promise,lock)
{
    if(lock)
	return promise(lock);
    else{
	return navigator.locks.request(
	    this._lock_api,
	    (lock)=>{
		this._screen_guard.set_loading();
		return promise(lock);
	    }
	).finally((r)=>{
	    this._screen_guard.unset_loading();
	});
    }
}
Director.prototype.show_error=function(args)
{
    this.dialog.show({
	type:'error',
	title:args.title,
	message:args.message
    })
}

Director.prototype.open_tree=function(dir)
{
    this._writer_last_wd=this._writer.cwd;

    this._writer.detach();
    this._filer.attach();
    this.open_dir(dir,true);
}

Director.prototype.close_tree=function(dir)
{
    if(!dir)
	dir=this._writer_last_wd||this._filer._cwd;

    this.open_dir(dir,false).then((p)=>{
	this._filer.detach();
	this._writer.attach();
    });
}

Director.prototype.open_dir=function(dir,is_preview=false)
{
    return this.lock_with_loading(
	(lock)=>API.open_dir(dir,is_preview)
    ).then((result)=>{
	this._filer.build(result);
	if(is_preview)
	    this._writer._preview(result);
	else
	    this._writer._rendering(result,false,true);
	
	return Promise.resolve('dir-open');
    }).catch((e)=>{
	console.log(e);
	this.show_error({
	    title:e.name,
	    message:e.message
	});
	return Promise.reject('dir-open');
    });
}



Director.prototype._set_config=function(c)
{
    if(this._config)
       objectDeepMerge(this._config,c);
    else
	this._config=c;
}


window.onload=function(event){
    API.get_config().then(
	(c)=>document.director=new Director(c)
    ).then((r)=>{
	API.reg_on_error_handler(
	    document.director.show_error.bind(document.director)
	);
	API.reg_on_close_handler(
	    ()=>{
		document.director._writer._win_close_action=true;
	    }
	);
	//document.director._writer.cmd_dir_open();
	document.director.open_tree();
    });
}
