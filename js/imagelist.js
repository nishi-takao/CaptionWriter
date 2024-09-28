// imagelist.js -- a part of Caption Writer
//
// NISHI, Takao <nishi.t.es@osaka-u.ac.jp 
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
function ImageItem(fn,is_dir)
{
    this.path=fn;
    
    if(is_dir)
	this.is_dir=true;
    else{
	this.is_dir=false;
	this.test_annotation();
	this.img_sz=null;
    }
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
    if(this.is_dir)
	return null;
    
    if(!this.img_sz)
	this.img_sz=ImageSize(this.path);

    return this.img_sz;
}

ImageItem.prototype.read_image=async function()
{
    if(this.is_dir)
	return null;
    
    let content=FS.readFileSync(this.path);
    let ft=await FileType.fromBuffer(content);
    ft=(ft && ft.mime) ? ft.mime : 'application/octet-stream';

    return 'data:'+ft+';base64,'+content.toString('base64');
};

ImageItem.prototype.test_annotation=function()
{
    if(this.is_dir)
	return false;
    
    this.annotation_path=this.img2ann(this.path);
    this.has_annotation=FS.existsSync(this.annotation_path);
    
    return this.has_annotation;
};

ImageItem.prototype.read_annotation=async function()
{
    if(this.is_dir)
	return false;
    
    var anno=null;
    if(!this.annotation_path)
	this.test_annotation();
    
    if(this.has_annotation)
	anno=FS.readFileSync(this.annotation_path).toString('utf-8')
    
    return anno;
};

ImageItem.prototype.write_annotation=function(anno)
{
    if(this.is_dir)
	return false;

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
    if(this.is_dir||
       (!this.has_annotation))
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
	is_dir:this.is_dir,
	path:this.path,
	basename:this.basename(),
    };

    if(!this.is_dir){
	obj.annotation_path=this.annotation_path;
	obj.has_annotation=this.has_annotation;

	if(opt && opt.with_size)
	    obj.image_size=this.image_size();
    }

    
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
}
URIarmedImageItem.prototype=Object.create(
    ImageItem.prototype,
    {
	constructor:{
	    value:URIarmedImageItem,
	    enumerable: true,
	    writable: true,
	    configurable: true
	}
    }
);
URIarmedImageItem.prototype.dump=function(opt)
{
    var obj={
	is_dir:this.is_dir,
	path:encodeURI(this.path),
	basename:encodeURI(this.basename()),
    };
    
    if(!this.is_dir){
	obj.annotation_path=encodeURI(this.annotation_path);
	obj.has_annotation=this.has_annotation;

	if(opt && opt.with_size)
	    obj.image_size=this.image_size();
    }
    
    return obj;
}
//
// end of URIarmedImageItem
//
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
//
//
//
function ImageList({dir=null,with_URIarm=false})
{
    this.cwd=".";
    this.dirs=new Map();
    this.images=new Map();
    this._URIarm=with_URIarm;
    
    if(dir)
	this.scan(dir);
};

ImageList.prototype.scan=function(dir,with_dir=true)
{
    var self=this;
    this.cwd=Path.resolve(dir);
    this.dirs.clear();
    this.images.clear();
    
    var files=null;
    try{
	files=FS.readdirSync(this.cwd);
    }
    catch(e){
	this.cwd=null;
	throw e;
    }
    
    const I=this._URIarm ? URIarmedImageItem : ImageItem;
    files.forEach(function(fn){
	var fullpath=Path.resolve(Path.join(dir,fn));
	var stat;
	try{
	    stat=FS.statSync(fullpath);
	}
	catch(err){}
	
	if(stat){
	    if(stat.isDirectory() && with_dir){
		self.dirs.set(
		    fullpath,
		    new I(fullpath,true)
		);
	    }
	    else if(stat.isFile()){
		var ext=Path.extname(fn);
		if(ext.match(ImageFileExtRegexp)){
		    self.images.set(
			fullpath,
			new I(fullpath,false)
		    );
		}
	    }
	}
    });

    return this;
};

ImageList.prototype.is_root_dir=function()
{
    return this.cwd===Path.resolve(this.cwd,'..');
}

ImageList.prototype.parent_dir=function()
{
    return Path.resolve(this.cwd,'..');
}

ImageList.prototype.path_join=function(fn)
{
    return Path.resolve(this.cwd,fn);
}
ImageList.prototype.get_image=function(path)
{
    if(this._URIarm || with_decode)
	path=decodeURI(path);

    return this.images.get(path);
}
ImageList.prototype.get_image_by_index=function(idx)
{
    return this.images.values().toArray()[idx];
}

ImageList.prototype.dump=function()
{
    return {
	cwd:this.cwd,
	parent_dir: this.is_root_dir()?null:this.parent_dir(),
	dirs:this.dirs.values().toArray().map((d)=>d.dump()),
	images:this.images.values().toArray().map((d)=>d.dump())
    };
    
}
module.exports=ImageList;
