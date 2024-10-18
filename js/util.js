//
//
//
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

try{
    exports.escapeHTML=escapeHTML;
    exports.objectDeepMerge=objectDeepMerge;
}
catch(e){}
