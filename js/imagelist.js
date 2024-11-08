// imagelist.js -- a part of Caption Writer
//
// NISHI, Takao <nishi.t.es@osaka-u.ac.jp>
//
"use strict";

const FS=require('fs');
const Path=require('path');
const FileType=require('file-type');

const ImageSize=require("image-size");

const ImageFileExtRegexp=/\.((jpg)|(jpeg)|(png))/i;
const AnnoFileExt='.caption';

////////////////////////////////////////////////////////////////////////
//
//
//
function ImageItem(fn)
{
    this.path=fn;
    
    this.test_annotation();
    this.img_sz=null;
};

ImageItem.prototype.img2ann=function(fn)
{
    let dir=Path.dirname(fn);
    let ext=Path.extname(fn);
    let basename=Path.basename(fn,ext);

    return Path.resolve(Path.join(dir,basename+AnnoFileExt));
};

ImageItem.prototype.basename=function()
{
    return Path.basename(this.path);
};

ImageItem.prototype.read_all=async function()
{
    if(this.is_dir)
	return null;
    
    let content=this.read_image();
    let anno=this.read_annotation();
    let sz=this.image_size();
    
    return {
	'image':{
	    'width':sz ? sz.width : null,
	    'height':sz ? sz.height : null,
	    'body':await content
	},
	'anno':await anno
    }
}

ImageItem.prototype.image_size=function()
{
    if(!this.img_sz)
	this.img_sz=ImageSize(this.path);

    return this.img_sz;
}

ImageItem.prototype.read_image=async function()
{
    let content=FS.readFileSync(this.path);
    let ft=await FileType.fromBuffer(content);
    ft=(ft && ft.mime) ? ft.mime : 'application/octet-stream';

    return 'data:'+ft+';base64,'+content.toString('base64');
};

ImageItem.prototype.test_annotation=function()
{
    this.annotation_path=this.img2ann(this.path);
    this.has_annotation=FS.existsSync(this.annotation_path);
    
    return this.has_annotation;
};

ImageItem.prototype.read_annotation=async function()
{
    var anno=null;
    if(!this.annotation_path)
	this.test_annotation();
    
    if(this.has_annotation)
	anno=FS.readFileSync(this.annotation_path).toString('utf-8')
    
    return anno;
};

ImageItem.prototype.write_annotation=function(anno)
{
    try{
	if(this.has_annotation)
	    FS.renameSync(this.annotation_path,this.annotation_path+'.bak');
	FS.writeFileSync(this.annotation_path,anno);
	
	this.has_annotation=true;
	return true;
    }
    catch(e){
	console.log(e);
	return false;
    }
};
ImageItem.prototype.remove_annotation=function()
{
    if(!this.has_annotation)
	return false;
    
    try{
	FS.renameSync(this.annotation_path,this.annotation_path+'.bak');

	this.has_annotation=false;
    
	return true;
    }
    catch(e){
	console.log(e);
	return false;
    }
    
};
ImageItem.prototype.dump=function(opt)
{
    var obj={
	path:this._URIarm ? encodeURI(this.path) : this.path,
	path_raw:this.path,
	basename:this.basename(),
	annotation_path:this.annotation_path,
	has_annotation:this.has_annotation
    };

    if(opt?.with_size)
	obj.image_size=this.image_size();

    
    return obj;
}
//
// end of ImageItem
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
// ImageItem with URI encode
//
// I know it is very old-fashioned.
//
function URIarmedImageItem(fn,is_dir)
{
    ImageItem.prototype.constructor.call(this,fn,is_dir);
    this._URIarm=true;
}
URIarmedImageItem.prototype=Object.create(
    ImageItem.prototype,
    {
	constructor:{
	    value:URIarmedImageItem,
	    enumerable: false,
	    writable: true,
	    configurable: true
	}
    }
);
//
// end of URIarmedImageItem
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//
// Node Object for Directory Tree
//
function DirItem(path,recurse=true)
{
    this.path=null;
    this.basename=null;
    this.is_drive=false;
    this.dirs=new Map();
    this.parent=null;
    this._URIarm=false;
    
    if(path)
	this.build(path,recurse);
}
DirItem.DriveNode=null;

DirItem.prototype.build=function(path,recurse=true)
{
    this.path=Path.resolve(path);
    this.basename=Path.basename(this.path);
    if(process.platform=='win32' && path.endsWith(':'))
	this.is_drive=true;
	
    if(!recurse)
	return this;
    
    let _p=Path.resolve(Path.join(path,'..'));
    if(_p==path){
	if(this.is_drive){
	    if(!DirItem.DriveNode)
		DirItem.DriveNode=new DriveNode(this._URIarm);
	    this.parent=DirItem.DriveNode;
	    let d=this.parent.dirs.get(this.path);
	    if(d){
		d.parent=null;
		this.parent.dirs.delete(this.path);
	    }
	    this.parent.add_child(this)
	}
	else
	    this.parent=null;
    }
    else{
	let D=Object.getPrototypeOf(this).constructor;
	this.parent=new D(_p,true);
	this.parent.add_child(this);
    }

    return this;
}
DirItem.prototype.add_child=function(path_or_node)
{
    let path,node;
    if(path_or_node.path){
	path=path_or_node.path;
	node=path_or_node;
    }
    else{
	path=path_or_node;
	node=new (Object.getPrototypeOf(this).constructor)(path,false);
    }
    node.parent=this;
    this.dirs.set(path,node);
    return this;
}
DirItem.prototype.root_node=function()
{
    if(this.parent)
	return this.parent.root()
    else
	return this;
}
DirItem.prototype.dump=function(dir=1)
{
    let obj={
	path: this._URIarm ? encodeURI(this.path) : this.path,
	path_raw: this.path,
	basename: this.basename,
	is_drive: this.is_drive,
    }

    if(dir>0){
	let d=this.dirs.keys().toArray();
	d.sort();
	obj.dirs=d.map((k)=>this.dirs.get(k).dump(dir));
    }
    else if(dir<0)
	obj.parent=this.parent ? this.parent.dump(dir) : null;
    
    return obj;
}
//
// end of DirItem
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
// DirItem with URI encode
//
function URIarmedDirItem(path,recurse=true)
{
    DirItem.prototype.constructor.call(this,path,recurse);
    this._URIarm=true;
}
URIarmedDirItem.prototype=Object.create(
    DirItem.prototype,
    {
	constructor:{
	    value:URIarmedDirItem,
	    enumerable: false,
	    writable: true,
	    configurable: true
	}
    }
);
//
// end of URIarmedDirItem
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
// Drive node for Windows
//
function DriveNode(with_URIarm)
{
    DirItem.prototype.constructor.call(this,null);
    
    this.path='\\\\';
    this._URIarm=with_URIarm;
    const D=with_URIarm ? URIarmedDirNode: DirNode;
    
    let drives=require('windows-drive-letters').usedSync();

    drives.forEach((d)=>{
	this.add_child(new D(d+':',false));
    });
}
DriveNode.prototype=Object.create(
    DirItem.prototype,
    {
	constructor:{
	    value:DriveNode,
	    enumerable: false,
	    writable: true,
	    configurable: true
	}
    }
);
DriveNode.prototype.dump=function(dir)
{
    let d=this.dirs.keys().toArray();
    d.sort();
    return {
	path: this.path,
	path_raw: this.path,
	drives: d.map((k)=>this._dirs.get(k).dump(dir)),
    };
}
//
// end of DriveNode
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
//
//
function ImageList({dir=null,with_URIarm=false})
{
    this.cwd=null;
    this.images=new Map();
    this.tree=null;
    this._URIarm=with_URIarm;
    
    this._wd=null;
    this._preview=null;

    if(dir)
	this.scan(dir);
};

ImageList.prototype.scan=function(dir,explicit=true)
{
    this._wd=Path.resolve(dir);
    this.images.clear();
    this._preview=null;
    
    let files=null;
    try{
	files=FS.readdirSync(this._wd);
    }
    catch(e){
	this._wd=null;
	throw e;
    }
    
    const D=this._URIarm ? URIarmedDirItem : DirItem;
    const I=this._URIarm ? URIarmedImageItem : ImageItem;

    this.tree=new D(this._wd);
    this.tree._expanded=true;
    
    files.forEach((fn)=>{
	let fullpath=Path.resolve(Path.join(dir,fn));
	let stat;
	try{
	    stat=FS.statSync(fullpath);
	}
	catch(err){}
	
	if(stat){
	    if(stat.isDirectory())
		this.tree.add_child(new D(fullpath,false));
	    else if(stat.isFile()){
		let ext=Path.extname(fn);
		if(ext.match(ImageFileExtRegexp)){
		    this.images.set(
			fullpath,
			new I(fullpath,false)
		    );
		}
	    }
	}
    },this);
    
    if(explicit || !this.cwd)
	this.cwd=this._wd;
    
    return this;
};

ImageList.prototype.path_join=function(fn)
{
    return Path.resolve(this._wd,fn);
}
ImageList.prototype.get_image=function(path)
{
    if(this._URIarm)
	path=decodeURI(path);

    return this.images.get(path);
}
ImageList.prototype.get_image_by_index=function(idx)
{
    return this.images.values().toArray()[idx];
}
ImageList.prototype.get_dir=function(path)
{
    if(this._URIarm)
	path=decodeURI(path);

    return this.scan(path,false)
}

ImageList.prototype.dump=function()
{
    let obj=this.tree?.dump(-1) || {};
    obj.cwd=this._wd;
    obj.images=this.images.values().toArray().map((d)=>d.dump());

    let d=this.tree.dirs.keys().toArray();
    d.sort();
    obj.dirs=d.map((k)=>this.tree.dirs.get(k).dump(0));

    return obj;
}
//
// end of ImageList
//
////////////////////////////////////////////////////////////////////////

module.exports=ImageList;
