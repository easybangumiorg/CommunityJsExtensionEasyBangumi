import java.nio.file.*;
import org.mozilla.javascript.*;
public class LmmFixtures {
    public static class Summary {
        private final String id;
        private final String source;
        public Summary(String id, String source) { this.id=id; this.source=source; }
        public String getId() { return id; }
        public String getSource() { return source; }
        // Real CartoonSummary intentionally has no title or cover getters.
    }
    public static String read(String path) throws Exception { return Files.readString(Path.of(path)); }
    public static void main(String[] args) throws Exception {
        Context context = Context.enter();
        try {
            context.setLanguageVersion(Context.VERSION_ES6);
            context.setOptimizationLevel(-1);
            Scriptable scope = new ImporterTopLevel(context);
            scope.put("fixtureRoot", scope, Context.javaToJS(args[1], scope));
            scope.put("sourceText", scope, Context.javaToJS(read(args[0]), scope));
            context.evaluateString(scope, read(args[2]), args[2], 1, null);
        } finally { Context.exit(); }
    }
}
