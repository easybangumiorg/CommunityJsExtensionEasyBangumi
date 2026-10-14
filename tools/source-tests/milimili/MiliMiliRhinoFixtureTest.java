import org.mozilla.javascript.Context;
import org.mozilla.javascript.ImporterTopLevel;
import org.mozilla.javascript.Scriptable;
import java.nio.file.Files;
import java.nio.file.Path;

/** Offline Rhino 1.7.15 contract and sanitized public-metadata fixture regression. */
public class MiliMiliRhinoFixtureTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("Usage: MiliMiliRhinoFixtureTest <source.js> <fixture-dir> <test-tools-dir>");
        }
        Path source = Path.of(args[0]);
        Path fixtures = Path.of(args[1]);
        Path testTools = Path.of(args[2]);
        Context context = Context.enter();
        try {
            context.setOptimizationLevel(-1);
            // ES5 syntax is sufficient; also validates embedded browser scripts.
            context.setLanguageVersion(Context.VERSION_1_8);
            Scriptable scope = new ImporterTopLevel(context);
            context.evaluateString(scope, Files.readString(testTools.resolve("milimili-fixture-bootstrap.js")), "bootstrap", 1, null);
            context.evaluateString(scope, Files.readString(source), source.toString(), 1, null);
            for (String name : new String[] {"home", "search", "detail"}) {
                context.evaluateString(scope, "var fixture_" + name + " = " + Files.readString(fixtures.resolve(name + "-api.json")) + ";", name, 1, null);
            }
            context.evaluateString(scope, Files.readString(testTools.resolve("milimili-fixture-test.js")), "fixture-test.js", 1, null);
        } finally {
            Context.exit();
        }
    }
}
