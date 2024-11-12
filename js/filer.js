// filer.js -- a part of Caption Writer
//
// NISHI, Takao <nishi.t.es@osaka-u.ac.jp>
//
"use strict";

const DBLCLICK_TIMEOUT=300;

////////////////////////////////////////////////////////////////////////
//
// Directory Structure
//
function TreeNode(obj=null)
{
    this.path=null;
    this.path_raw=null;
    this.basename=null;
    this.is_drive=false;
    this.is_fixed=false;
    this.has_error=false;
    
    this._dirs=new Map();
    this._parent=null;
    
    this._element=null;
    this._child_elm=null;
    
    this._is_drive_list=false;
    this._is_expanding=false;
    this._is_cwd=false;
    
    if(obj)
	this.parse(obj);
}
TreeNode.node_dic={};
TreeNode.raw2enc={};
TreeNode.get_node=function(obj)
{
    let path=obj.drives ? '\\\\' : obj.path || obj;
    if(!path){
	throw 'Could not determinate path';
    }
    if(TreeNode.node_dic[path])
	return TreeNode.node_dic[path];
    else
	return new TreeNode(obj);
}

TreeNode.prototype.parse=function(obj)
{
    let path=obj.path;

    if(this.path==path)
	return this._update(obj);
    else if(TreeNode.node_dic[path])
	return TreeNode.node_dic[path]._update(obj);

    this.path=path;
    this.path_raw=obj.path_raw;
    TreeNode.node_dic[this.path]=this;
    TreeNode.raw2enc[obj.path_raw]=path;

    this.path_raw=obj.path_raw
    this._element=document.createElement('li');
    this.path=path;
    if(obj.drives){
	this.is_fixed=true;
	this._is_drive_list=true;
	this._element.className='drive-list';
	Object.values(obj.drives).forEach((o)=>{
	    this.add_child(TreeNode.get_node(o))
	})
	this._child_elm.id='drives-root';
    }
    else{
	this.basename=obj.basename;
	this.is_drive=obj.is_drive||false;
	this.is_fixed=obj.is_fixed||false;
	if(obj.error){
	    this.has_error=true;
	    this.is_fixed=false;
	}
	this._build_className();

	this._element.dataset.path=this.path;
	this._element.appendChild(
	    document.createTextNode(this.basename)
	);

	// top-down
	if(obj.dirs){
	    Object.values(obj.dirs).forEach((o)=>{
		this.add_child(TreeNode.get_node(o));
	    });
	}
	// bottom-up
	if(obj.parent){
	    let p=TreeNode.get_node(obj.parent)
	    p.add_child(this);
	}
    }

    return this;
}
TreeNode.prototype._update=function(obj)
{
    let path=obj.path;
    this.is_drive=obj.is_drive||false;
    if(obj.is_fixed){
	this.is_fixed=obj.is_fixed;
	let src=this._dirs.values().toArray();
	let dst=obj.drives || obj.dirs;
	src.forEach((o)=>{
	    if(dst[o.path])
		o._update(dst[o.path]);
	    else
		o.remove_me();
	});
	Object.values(dst).forEach((o)=>{
	    if(!this._dirs.has(o.path))
		this.add_child(new TreeNode(o));
	});

	this._build_className();
    }
    else if(obj.error){
	this.is_fixed=false;
	this.has_error=true;
    }
    else{
	if(obj.error===null)
	    this.has_error=false;

	let src=obj.drives || obj.dirs;
	if(!src)
	    return this;
	
	Object.values(src).forEach((o)=>{
	    let n=this._dirs.get(o.path);
	    if(n)
		n._update(o);
	    else
		this.add_child(new TreeNode(o));
	});
    }
    
    return this;
}

TreeNode.prototype.add_child=function(node)
{
    this._dirs.set(node.path,node);
    node._parent=this;
    
    if(this._child_elm){
	//
	// reorder elements
	//
	while(this._child_elm.firstChild)
	    this._child_elm.removeChild(this._child_elm.firstChild);
	
	let arr=this._dirs.values().toArray();
	arr.sort((a,b)=>{
	    if(a.basename<b.basename)
		return -1;
	    else if(a.basename>b.basename)
		return 1;
	    else
		return 0;
	});
	arr.forEach((x)=>{
	    this._child_elm.append(x._element);
	},this);
    }
    else{
	this._child_elm=document.createElement('ul');
	this._element.appendChild(this._child_elm);
	this._child_elm.append(node._element);
    }
    
    return this;
}
TreeNode.prototype.remove_me=function()
{
    this._dirs.forEach((o)=>{
	o.remove_me();
    });
    
    if(this._parent)
	this._parent._remove_child(this);
    
    this._parent=null;
    delete this._element;
    delete TreeNode.node_dic[this.path];
}
TreeNode.prototype._remove_child=function(node)
{
    this._dirs.delete(node.path);
    this._child_elm.removeChild(node._element);
    if(this._dirs.size==0){
	this._element.removeChild(this._child_elm);
	delete this._child_elm;
    }
}
TreeNode.prototype.root_node=function()
{
    if(!this._parent)
	return this;
    else
	return this._parent.root_node();
}
TreeNode.prototype.set_fixed=function(o)
{
    if(this.has_error){
	if(o?.error || o.error===undefined)
	    return this;
	else
	    this.has_error=false;
    }
    else if(o?.error){
	this.is_fixed=false;
	this.has_error=true;
	this._build_className();
	return this;
    }

    this.is_fixed=true;
    if(o?.dirs){
	Object.values(o.dirs).forEach((d)=>{
	    this.add_child(TreeNode.get_node(d.path))
	})
    }
    this._build_className();

    return this;
}
TreeNode.prototype.expand=function()
{
    this._is_expanding=true;
    this._build_className();

    if(this.is_drive || !this._parent)
	return this;
    else
	this._parent.expand();
    
    return this;
}
TreeNode.prototype.shrink=function()
{
    this._is_expanding=false;
    this._build_className();

    return this;
}
TreeNode.prototype.toggle_expand=function()
{
    if(this._is_expanding)
	return this.shrink();
    else
	return this.expand();
}
TreeNode.prototype.set_cwd=function()
{
    this._is_cwd=true;
    this._build_className();
    if(this.is_drive || !this._parent)
	return this;
    else
	this._parent.expand();

    return this;
}
TreeNode.prototype.unset_cwd=function()
{
    this._is_cwd=false;
    this._build_className();

    return this;
}
TreeNode.prototype._build_className=function()
{
    if(this._is_drive_list)
	this._element.className='drive-list';
    else{
	let cls=[];
	if(this._is_cwd)
	    cls.push('cwd');
	if(this.has_error)
	    cls.push('error');
	else{
	    /*
	    if(!this.is_fixed)
		cls.push('unfixed');
	    */
	    if(this._is_expanding)
		cls.push('open');
	}
	this._element.className=cls.join(' ');
    }

    return this._element.className;

}
//
// end of TreeNode
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
// Directory tree UI Controller
//
function Filer(parent,config={})
{
    this._parent=parent;

    this._config={};
    this._set_config(config);

    this._global_event_listner=null;

    this._tree=null;
    this._cwd=null;

    this._elm={};

    this._elm.base=document.getElementById('filer');
    this._elm.tree_root=document.getElementById('tree');

    this._elm.btn={};
    this._elm.btn.open=document.getElementById('filer-open');
    this._elm.btn.reload=document.getElementById('filer-reload');
    this._elm.btn.cancel=document.getElementById('filer-cancel');

    this._add_event_listeners();
}

Filer.prototype.build=function(obj)
{
    const CRIT_ERRS=/(ENOENT|ENOTDIR)/;
    
    if(!(obj.path && obj.cwd))
	return;

    if(this._tree)
	this._tree.parse(obj);
    else{
	let t=new TreeNode(obj);
	this._tree=t.root_node();
	
	while(this._elm.tree_root.firstChild){
	    this._elm.tree_root.removeChild(
		this._elm.tree_root.firstChild
	    );
	}
	this._elm.tree_root.appendChild(this._tree._element);
    }

    if(obj.error?.code?.match(CRIT_ERRS)){
	let n=TreeNode.node_dic[TreeNode.raw2enc[obj.cwd]];
	if((this._cwd==n?.path)||!this._cwd){
	    let p=n?._parent;
	    this._cwd=p?.path;
	    p?.set_cwd();
	}
	n.remove_me();
    }
    else{
	if(this._cwd)
	    TreeNode.node_dic[this._cwd]?.unset_cwd();
	
	this._cwd=TreeNode.raw2enc[obj.cwd];
	let o=TreeNode.node_dic[this._cwd];
	if(o){
	    o.set_cwd();
	    if(obj.dirs)
		o.set_fixed(obj);
	}
    }
}
Filer.prototype.attach=function()
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
Filer.prototype.detach=function()
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

Filer.prototype.cmd_up=function(target)
{
    let items=this._get_displayed_items();
    let idx=items.indexOf(target._element);
    if(idx>0){
	let obj=TreeNode.node_dic[items[idx-1].dataset.path];
	this.cmd_set_cwd(obj,target);
    }
}
Filer.prototype.cmd_goto_parent=function(target)
{
    if(target.is_drive)
	return;
    
    let p=target._parent;
    if(!p)
	return;

    this.cmd_set_cwd(p,target);
}
Filer.prototype.cmd_goto_prev_sibling=function(target)
{
    let obj=TreeNode.node_dic[target._element.previousSibling?.dataset?.path];
    if(obj)
	this.cmd_set_cwd(obj,target);
}

Filer.prototype.cmd_down=function(target)
{
    let items=this._get_displayed_items();
    let idx=items.indexOf(target._element);
    if(idx>=0 && idx<items.length-1){
	let obj=TreeNode.node_dic[items[idx+1].dataset.path];
	this.cmd_set_cwd(obj,target);
    }
}
Filer.prototype.cmd_goto_child=function(target)
{
    if(target._dirs.size==0)
	return;

    let obj=target._dirs.values().toArray();
    obj.sort((a,b)=>{
	if(a.basename<b.basename)
	    return -1;
	else if(a.basename>b.basename)
	    return 1;
	else
	    return 0;
    });
    this.cmd_set_cwd(obj[0],target);
    
}
Filer.prototype.cmd_goto_next_sibling=function(target)
{
    let obj=TreeNode.node_dic[target._element.nextSibling?.dataset?.path];
    if(obj)
	this.cmd_set_cwd(obj,target);
}

Filer.prototype.cmd_move_to=function(target,key){
    let el=target._is_expanding ?
	target._child_elm : target._parent?._child_elm;
    if(!el)
	return;

    let c=this._get_displayed_items(el.getElementsByTagName('li')).map(
	(x)=>TreeNode.node_dic[x.dataset?.path]
    ).filter((x)=>x);
    
    if(!target._is_expanding){
	let idx=c.findIndex((x)=>x==target);
	if(idx>=0 && idx<c.length-1)
	    c=c.slice(idx+1,c.length).concat(c.slice(0,idx));
    }
    
    for(let i=0;i<c.length;i++){
	if(c[i].basename?.startsWith(key) &&
	   c[i].basename!=target.basename)
	    return this.cmd_set_cwd(c[i],target);
    }
}

Filer.prototype.cmd_expand=function(target,goto_child_when_shrinked=false)
{
    if(target.has_error)
	return;
    
    if(target._is_expanding){
	if(goto_child_when_shrinked)
	    this.cmd_goto_child(target);
    }
    else
	target.expand();
}
Filer.prototype.cmd_shrink=function(target,goto_parent_when_shrinked=false)
{
    if(target._is_expanding)
	target.shrink();
    else if(goto_parent_when_shrinked)
	this.cmd_goto_parent(target);
}
Filer.prototype.cmd_open=function(target)
{
    if(target.has_error)
	return;
    
    this._parent.close_tree(target.path);
}
Filer.prototype.cmd_cancel=function()
{
    this._parent.close_tree(null);
}
Filer.prototype.cmd_rescan=function(target)
{
    this.cmd_set_cwd(target,null,true);
}
Filer.prototype.cmd_toggle_expand=function(target)
{
    target.toggle_expand();
}
Filer.prototype.cmd_set_cwd=function(
    target,
    current_cwd_obj=null,
    force_scan=false)
{
    if(!target)
	return;
    
    if(!current_cwd_obj)
	current_cwd_obj=TreeNode.node_dic[this._cwd];
    current_cwd_obj?.unset_cwd();
    
    if(force_scan||!target.has_error){
	this._parent.open_dir(target.path,true).then((p)=>{
	    target.set_cwd();
	    this._elm.btn.open.disabled=p.error ? true : false;
	    target._element.scrollIntoView({
		block:'start',
		inline:'nearest'
	    });
	    return p;
	});
    }
    else{
	this._parent.show_empty_preview(target.path_raw);
	this._cwd=target.path;
	target.set_cwd();
	this._elm.btn.open.disabled=true;
	target._element.scrollIntoView({
	    block:'start',
	    inline:'nearest'
	});
	return Promise.resolve('cwd_on_error');
    }
}

Filer.prototype._set_config=function(c)
{
    if(this._config)
	objectDeepMerge(this._config,c);
    else
	this._config=c;
}

Filer.prototype._add_event_listeners=function()
{
    // buttons
    this._elm.btn.open.addEventListener(
	'click',
	(event)=>{
	    if(this._is_loading())
		return;
	    let obj=TreeNode.node_dic[this._cwd];
	    if(!obj)
		return;
	    
	    this.cmd_open(obj);
	}
    );
    this._elm.btn.reload.addEventListener(
	'click',
	(event)=>{
	    if(this._is_loading())
		return;
	    let obj=TreeNode.node_dic[this._cwd];
	    if(!obj)
		return;
	    
	    this.cmd_rescan(obj);
	}
    );
    this._elm.btn.reload.addEventListener(
	'click',
	(event)=>{
	    if(this._is_loading())
		return;
	    
	    this.cmd_cancel();
	}
    );

    const onclick=(event)=>{
	delete this._click_timer[event.target];
	let obj=TreeNode.node_dic[event.target?.dataset?.path];
	if(!obj)
	    return;
	if(obj._is_cwd)
	    obj.toggle_expand()
	else{
	    this.cmd_set_cwd(obj);
	    this.cmd_expand(obj);
	}
    };
    
    this._click_timer={}
    this._elm.tree_root.addEventListener(
	'click',
	(event)=>{
	    if(this._is_loading())
		return;
	    event.preventDefault();
	    event.stopPropagation();
	    if(!this._click_timer[event.target])
		this._click_timer[event.target]=setTimeout(
		    onclick,
		    DBLCLICK_TIMEOUT,
		    event
		);
	}
    );
    this._elm.tree_root.addEventListener(
	'dblclick',
	(event)=>{
	    if(this._is_loading())
		return;
	    event.preventDefault();
	    event.stopPropagation();
	    clearTimeout(this._click_timer[event.target]);
	    delete this._click_timer[event.target];
	    let obj=TreeNode.node_dic[event.target?.dataset?.path];
	    if(obj)
		this.cmd_open(obj);
	}
    );

    this._buid_global_event_listners();
}

Filer.prototype._buid_global_event_listners=function()
{
    const JUMP_KEYS=/^[\,\._~\-\+\=a-zA-Z0-9]$/;
    
    this._global_event_listners=[
	{
	    event:'keydown',
	    func:(event)=>{
		if(this._is_loading()){
		    if(event.key=='L' && event.ctrlKey){
			event.preventDefault();
			event.stopPropagation();
			this._parent.screen_guard.unset_screenlock();
		    }
		    return;
		}
		else if(this._parent._dialog._status=='opend')
		    return;
		
		let obj=TreeNode.node_dic[this._cwd];
		if(!obj)
		    return;
		
		switch(event.key){
		case 'ArrowUp':
		    event.preventDefault();
		    event.stopPropagation();
		    if(event.ctrlKey)
			this.cmd_goto_parent(obj);
		    else if(event.shiftKey)
			this.cmd_goto_prev_sibling(obj);
		    else
			this.cmd_up(obj);
		    break;
		case 'ArrowDown':
		    event.preventDefault();
		    event.stopPropagation();
		    if(event.ctrlKey)
			this.cmd_goto_child(obj);
		    else if(event.shiftKey)
			this.cmd_goto_next_sibling(obj);
		    else
			this.cmd_down(obj);
		    break;
		case 'ArrowRight':
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_expand(obj,true);
		    break;
		case 'ArrowLeft':
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_shrink(obj,true);
		    break;
		case 'Enter':
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_open(obj);
		    break;
		case 'Escape':
		    event.preventDefault();
		    event.stopPropagation();
		    this.cmd_cancel();
		    break;
		case ' ':
		    event.preventDefault();
		    event.stopPropagation();
		    if(event.ctrlKey)
			this.cmd_rescan(obj);
		    else
			this.cmd_toggle_expand(obj);
		    break;
		default:
		    if(event.ctrlKey){
			switch(event.key){
			case 'L':
			    event.preventDefault();
			    event.stopPropagation();
			    this._parent.screen_guard.toggle_screenlock();
			    break;
			case 'r':
			    event.preventDefault();
			    event.stopPropagation();
			    this.cmd_rescan(obj);
			    break;
			}
		    }
		    else if(event.altKey){
			// nop
		    }
		    else if(event.key.match(JUMP_KEYS)){
			event.preventDefault();
			event.stopPropagation();
			this.cmd_move_to(obj,event.key);
		    }
		    //console.log([event,event.key.charCodeAt()]);
		}
	    },
	    opt:null
	},
    ];
}
Filer.prototype._is_loading=function()
{
    return this._parent.screen_guard.is_active;
}
Filer.prototype._get_displayed_items=function(c=null)
{
    if(!c){
	if(!this._dir_collection){
	    let el=document.getElementById('drives-root')||this._elm.tree_root;
	    this._dir_collection=el.getElementsByTagName('li');
	}
	c=this._dir_collection;
    }
    
    let buf=[];
    for(let i=0;i<c.length;i++){
	// check displayed or not
	if(c[i].getClientRects().length>0)
	    buf.push(c[i]);
    }

    return buf;
}
