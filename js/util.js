//
//
//
const API=window.extra.api;

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

function objectDeepMerge(dst,src){
    Object.entries(src).forEach(([k,v])=>{
	if(typeof(v)=='object'){
	    if(!dst[k])
		dst[k]={};
	    objectDeepMerge(dst[k],v);
	}
	else
	    dst[k]=v;
    })
};


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
