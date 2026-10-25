import org.mozilla.javascript.Context;
import org.mozilla.javascript.ImporterTopLevel;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.ScriptableObject;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Offline ES5/Rhino contract regression using sanitized formal-site metadata. */
public class GglFormalRhinoFixtureTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("Usage: GglFormalRhinoFixtureTest <source.js> <fixture-dir> <tools-dir>");
        }
        Path source = Path.of(args[0]);
        Path fixtures = Path.of(args[1]);
        Path testTools = Path.of(args[2]);
        Context context = Context.enter();
        try {
            context.setOptimizationLevel(-1);
            context.setLanguageVersion(Context.VERSION_1_8);
            Scriptable scope = new ImporterTopLevel(context);
            String sourceText = Files.readString(source);
            Matcher key = Pattern.compile("(?m)^// @key (\\S+)$").matcher(sourceText);
            if (!key.find()) { throw new IllegalArgumentException("Source metadata has no key"); }
            ScriptableObject.putProperty(scope, "fixtureSourceKey", key.group(1));
            context.evaluateString(scope, Files.readString(testTools.resolve("ggl-formal-fixture-bootstrap.js")), "bootstrap", 1, null);
            context.evaluateString(scope, sourceText, source.toString(), 1, null);
            context.evaluateString(scope, "var fixtures = {};", "fixtures", 1, null);
            try (Stream<Path> paths = Files.list(fixtures)) {
                for (Path path : paths.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                    ScriptableObject.putProperty(scope, "fixtureText", Files.readString(path));
                    context.evaluateString(scope, "fixtures['" + path.getFileName() + "'] = JSON.parse(String(fixtureText));", path.toString(), 1, null);
                }
            }
            context.evaluateString(scope, Files.readString(testTools.resolve("ggl-formal-fixture-test.js")), "fixture-test.js", 1, null);
        } finally {
            Context.exit();
        }
    }
}
