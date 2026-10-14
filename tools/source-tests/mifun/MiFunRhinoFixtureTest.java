import org.mozilla.javascript.Context;
import org.mozilla.javascript.ImporterTopLevel;
import org.mozilla.javascript.Scriptable;
import java.nio.file.Files;
import java.nio.file.Path;

/** Offline Rhino ES5 contract checks using compact, sanitized MiFun fixtures. */
public class MiFunRhinoFixtureTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("Usage: MiFunRhinoFixtureTest <source.js> <fixtures-dir> <tools-dir>");
        }
        Path source = Path.of(args[0]);
        Path fixtures = Path.of(args[1]);
        Path tools = Path.of(args[2]);
        Context context = Context.enter();
        try {
            context.setLanguageVersion(Context.VERSION_1_8);
            context.setOptimizationLevel(-1);
            Scriptable scope = new ImporterTopLevel(context);
            for (String name : new String[] {"home", "search", "search-2", "search-empty", "detail", "play", "frame"}) {
                scope.put("fixture_" + name.replace('-', '_'), scope,
                    Context.javaToJS(Files.readString(fixtures.resolve(name + ".html")), scope));
            }
            context.evaluateString(scope, Files.readString(tools.resolve("mifun-fixture-bootstrap.js")), "bootstrap", 1, null);
            context.evaluateString(scope, Files.readString(source), source.toString(), 1, null);
            context.evaluateString(scope, Files.readString(tools.resolve("mifun-fixture-test.js")), "fixture-test", 1, null);
        } finally {
            Context.exit();
        }
    }
}
