import java.nio.file.*;
import org.mozilla.javascript.*;
public class CompileCycani {
    public static void main(String[] args) throws Exception {
        Context context = Context.enter();
        try {
            context.setLanguageVersion(Context.VERSION_ES6);
            context.setOptimizationLevel(-1);
            context.compileString(Files.readString(Path.of(args[0])), args[0], 1, null);
            Scriptable scope = context.initStandardObjects();
            context.evaluateString(scope, "var URI=java.net.URI; var ParserException=function(s){this.message=String(s);this.toString=function(){return this.message;};};", "host-stubs", 1, null);
            String source = Files.readString(Path.of(args[0]));
            int start = source.indexOf("function normalizeRootUrl");
            int end = source.indexOf("function getRootUrl", start);
            context.evaluateString(scope,"var CYC_DEFAULT_HOST='https://www.cycani.org';function cycText(v){return v==null?'':String(v).trim();}function cycFail(s){throw new ParserException(s);}" + source.substring(start,end),"host-check",1,null);
            String tests = "var valid=[['  cycani.example/??x#y  ','https://cycani.example'],['','https://www.cycani.org'],['http://localhost:8080/base///?q=1#x','http://localhost:8080/base'],['example.org:8443','https://example.org:8443'],['HTTPS://example.org///','https://example.org']];for(var i=0;i<valid.length;i++){var v=normalizeRootUrl(valid[i][0]);if(v!==valid[i][1])throw new Error('host mismatch '+v);}var invalid=['ftp://example.org','javascript:alert(1)','https://bad host','https://user:password@example.org','https://example.org:99999','https:///missing-host'];for(var j=0;j<invalid.length;j++){var thrown=false;try{normalizeRootUrl(invalid[j]);}catch(e){thrown=true;}if(!thrown)throw new Error('accepted invalid host '+j);}";
            context.evaluateString(scope,tests,"host-tests",1,null);
            System.out.println("Rhino 1.7.15 syntax and Java URI Host tests passed");
        } finally { Context.exit(); }
    }
}
