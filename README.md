# 🚀 Model IntelliSense for Java Spring Boot Thymeleaf



## ✨ Features

Intelligent autocompletion for Spring Boot model fields in Thymeleaf templates:

- **Automatic Model Detection**  
  Scans `@Entity`, `@Controller`, and service classes
- **Smart Field Suggestions**  
  Intellisense for `${student.name}`, `*{mobileNumber}`, etc.
- **Lombok & Record Support**  
  Works with `@Data`, `@Getter`, and Java records
- **Deep Spring Integration**  
  Understands `model.addAttribute()` mappings
- **Real-time Updating**  
  Rescans project every 10 seconds
- **Manual Refresh**  
  On-demand model rescanning

**Supported Field Types**:
- Entity fields (JPA/Hibernate)
- Getter methods (standard and boolean is*)
- Lombok-generated properties
- Record class components
- Nested model properties

![Thymeleaf IntelliSense Demo](https://example.com/demo.gif)

## 📦 Installation

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`)
2. Search for `Model IntelliSense for Java Spring Boot Thymeleaf`
3. Click **Install**
4. Reload VS Code when prompted

**Prerequisites**:  
- Java Spring Boot project
- Thymeleaf template files (.html)

## 🚀 Usage

### Automatic Suggestions
1. Open any Thymeleaf HTML file
2. Type `${` or `*{`
3. Start typing model variable name:
   ```html
   <td th:text="${student.▌"></td>

















   more info: optional to read // 





See field suggestions (e.g., name, mobileNumber, fees)

Manual Rescan
Press Ctrl+Shift+P

Run Model IntelliSense: Rescan Models command

See confirmation notification:

text
✅ Loaded 15 models, mapped 8 template variables
🛠 Configuration
Add to your VS Code settings.json:

json
{
  "modelIntellisense.autoScanInterval": 15000,
  "modelIntellisense.ignorePatterns": [
    "**/test/**",
    "**/dto/**"
  ]
}
Setting	Default	Description
autoScanInterval	10000	Rescan interval (ms)
ignorePatterns	[]	Glob patterns to exclude
🔧 Troubleshooting
Suggestions not appearing?

Ensure your project follows standard Spring Boot structure

Check models have proper getters or Lombok annotations

Run manual rescan command

Verify no relevant files in ignore patterns

Console Logs
View extension logs in VS Code Output panel (Ctrl+Shift+U) → Select Model IntelliSense

🌟 Pro Tips
Partial Matches: Type mobile to find mobileNumber

Case Insensitive: Works with STUDENT.name or Student.Name

Controller Mapping: Understands both:

java
model.addAttribute("students", studentRepo.findAll());
model.addAttribute("stud", new Student());
📝 Release Notes
2.2.0
Added Java Record class support

Improved Lombok detection

Fixed nested model handling

Enhanced performance






@atkiwisolution 

