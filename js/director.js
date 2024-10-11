//
//
//
Director=function(config={})
{
    this._config={};
    this._set_config(config);

    this._filer=null;
    this._writer=new Writer(this,this._config);

    this._writer.attach();
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
	    document.director._writer._show_error.bind(document.director._writer)
	);
	API.reg_on_close_handler(
	    ()=>{
		document.director._writer._win_close_action=true;
	    }
	);
	document.director._writer.cmd_dir_open();
    });
}
