"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ValidationError {
  field: string;
  message: string;
  index?: number;
}

export default function Component() {
  const [jsonInput, setJsonInput] = useState("");
  const [promptCount, setPromptCount] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const validateJson = () => {
    const validationErrors: ValidationError[] = [];

    try {
      const data = JSON.parse(jsonInput);

      // Trim all string values except 'prompt' field
      const trimStringValues = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(trimStringValues);
        } else if (obj !== null && typeof obj === "object") {
          const trimmed: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (key === "prompt") {
              // Don't trim the prompt field
              trimmed[key] = value;
            } else if (typeof value === "string") {
              trimmed[key] = value.trim();
            } else {
              trimmed[key] = trimStringValues(value);
            }
          }
          return trimmed;
        }
        return obj;
      };

      // Apply trimming to the parsed data
      const trimmedData = trimStringValues(data);

      const expectedPromptCount = Number.parseInt(promptCount);

      // Check if promptCount is a positive whole number
      if (
        !promptCount ||
        isNaN(expectedPromptCount) ||
        expectedPromptCount <= 0 ||
        !Number.isInteger(expectedPromptCount)
      ) {
        validationErrors.push({
          field: "prompt_count",
          message: "Number of prompts must be a positive whole number",
        });
      } // Check prompts array length
      if (!trimmedData.prompts || !Array.isArray(trimmedData.prompts)) {
        validationErrors.push({
          field: "prompts",
          message: "Prompts array is missing or not an array",
        });
      } else if (trimmedData.prompts.length !== expectedPromptCount) {
        validationErrors.push({
          field: "prompts",
          message: `Prompts array length (${trimmedData.prompts.length}) does not match expected count (${expectedPromptCount})`,
        });
      }

      // Check uuid and hfi_id consistency
      if (!trimmedData.uuid || trimmedData.uuid === "") {
        validationErrors.push({
          field: "uuid",
          message: "UUID should not be empty",
        });
      }

      // Check jira_id
      if (!trimmedData.jira_id || trimmedData.jira_id === "") {
        validationErrors.push({
          field: "jira_id",
          message: "JIRA ID should not be empty",
        });
      } else if (!trimmedData.jira_id.startsWith("ANTHS-")) {
        validationErrors.push({
          field: "jira_id",
          message: "JIRA ID should start with 'ANTHS-'",
        });
      }

      // Check programming_language
      if (
        !trimmedData.programming_language ||
        trimmedData.programming_language === ""
      ) {
        validationErrors.push({
          field: "programming_language",
          message: "Programming language should not be empty",
        });
      }

      // Check model
      const expectedModel =
        "83aa91117c2fac3e25a3757eaa59f29ed3aeaf4dd7d3d384c673086c321e0644";
      if (trimmedData.model !== expectedModel) {
        validationErrors.push({
          field: "model",
          message: `Model should be exactly: ${expectedModel}`,
        });
      }

      // Check root_gdrive
      if (!trimmedData.root_gdrive || trimmedData.root_gdrive === "") {
        validationErrors.push({
          field: "root_gdrive",
          message: "Root Google Drive should not be empty",
        });
      }

      // Check workflow and codebase
      if (
        !trimmedData.workflow ||
        !["new_codebase", "existing_codebase"].includes(trimmedData.workflow)
      ) {
        validationErrors.push({
          field: "workflow",
          message:
            "Workflow should be either 'new_codebase' or 'existing_codebase'",
        });
      } else {
        if (trimmedData.workflow === "new_codebase") {
          if (
            trimmedData.codebase?.url !== "" ||
            trimmedData.codebase?.description !== ""
          ) {
            validationErrors.push({
              field: "codebase",
              message:
                "For new_codebase workflow, codebase url and description should be empty",
            });
          }
        } else if (trimmedData.workflow === "existing_codebase") {
          if (!trimmedData.codebase?.url || trimmedData.codebase.url === "") {
            validationErrors.push({
              field: "codebase.url",
              message:
                "For existing_codebase workflow, codebase URL should not be empty",
            });
          }
          if (
            !trimmedData.codebase?.description ||
            trimmedData.codebase.description === ""
          ) {
            validationErrors.push({
              field: "codebase.description",
              message:
                "For existing_codebase workflow, codebase description should not be empty",
            });
          }
        }
      }

      // Validate prompts array
      if (trimmedData.prompts && Array.isArray(trimmedData.prompts)) {
        trimmedData.prompts.forEach((prompt: any, index: number) => {
          // Check hfi_id matches uuid
          if (prompt.hfi_id !== trimmedData.uuid) {
            validationErrors.push({
              field: "hfi_id",
              message: "HFI ID should match the main UUID",
              index,
            });
          }

          // Required fields check
          const requiredFields = [
            "hfi_id",
            "prompt",
            "choice",
            "gdrive",
            "usecase",
            "comment",
            "level_of_correctness",
            "level_of_correctness_comment",
            "memory_comment",
          ];

          requiredFields.forEach((field) => {
            if (field === "choice" || field === "level_of_correctness") {
              if (
                prompt[field] === undefined ||
                prompt[field] === null ||
                prompt[field] === ""
              ) {
                validationErrors.push({
                  field,
                  message: `${field} should not be empty`,
                  index,
                });
              }
            } else {
              // For string fields, check for empty or whitespace-only strings
              if (
                !prompt[field] ||
                (typeof prompt[field] === "string" &&
                  prompt[field].trim() === "")
              ) {
                validationErrors.push({
                  field,
                  message: `${field} should not be empty`,
                  index,
                });
              }
            }
          });
          // Check choice range
          if (
            typeof prompt.choice !== "number" ||
            prompt.choice < 0 ||
            prompt.choice > 7
          ) {
            validationErrors.push({
              field: "choice",
              message: "Choice should be a number between 0-7",
              index,
            });
          }

          // Check gdrive is a link
          if (prompt.gdrive && !prompt.gdrive.startsWith("http")) {
            validationErrors.push({
              field: "gdrive",
              message: "Google Drive should be a valid link",
              index,
            });
          }

          // Check usecase
          const validUsecases = [
            "initial_development",
            "feature_implementation",
            "debugging_fixes",
            "optimization_testing",
          ];
          if (!validUsecases.includes(prompt.usecase)) {
            validationErrors.push({
              field: "usecase",
              message: `Usecase should be one of: ${validUsecases.join(", ")}`,
              index,
            });
          }

          // Check issue fields consistency
          const issueFields = ["issue_type", "issue_comment", "issue_source"];
          const hasIssueData = issueFields.some(
            (field) => prompt[field] && prompt[field].trim() !== ""
          );

          if (hasIssueData) {
            issueFields.forEach((field) => {
              if (!prompt[field] || prompt[field].trim() === "") {
                validationErrors.push({
                  field,
                  message:
                    "If any issue field has value, all issue fields must have values",
                  index,
                });
              }
            });

            // Check issue_type values
            const validIssueTypes = [
              "missing_memory",
              "technical_inconsistency",
              "tool",
              "code_correctness",
              "setup",
              "other",
            ];
            if (
              prompt.issue_type &&
              !validIssueTypes.includes(prompt.issue_type)
            ) {
              validationErrors.push({
                field: "issue_type",
                message: `Issue type should be one of: ${validIssueTypes.join(
                  ", "
                )}`,
                index,
              });
            }
          }

          // Check level_of_correctness range
          if (
            typeof prompt.level_of_correctness !== "number" ||
            prompt.level_of_correctness < -1 ||
            prompt.level_of_correctness > 2
          ) {
            validationErrors.push({
              field: "level_of_correctness",
              message:
                "Level of correctness should be a number between -1 to 2",
              index,
            });
          }

          if (prompt.level_of_correctness !== 2) {
            const issueFields = ["issue_type", "issue_comment", "issue_source"];
            issueFields.forEach((field) => {
              if (!prompt[field] || prompt[field].trim() === "") {
                validationErrors.push({
                  field,
                  message: `${field} should not be empty when level_of_correctness is not 2`,
                  index,
                });
              }
            });

            // Check issue_type values when required
            const validIssueTypes = [
              "missing_memory",
              "technical_inconsistency",
              "tool",
              "code_correctness",
              "setup",
              "other",
            ];
            if (
              prompt.issue_type &&
              !validIssueTypes.includes(prompt.issue_type)
            ) {
              validationErrors.push({
                field: "issue_type",
                message: `Issue type should be one of: ${validIssueTypes.join(
                  ", "
                )}`,
                index,
              });
            }
          }
        });
      } // Check memory object
      if (!trimmedData.memory) {
        validationErrors.push({
          field: "memory",
          message: "Memory object is required",
        });
      } else {
        if (
          !trimmedData.memory.memory_comment ||
          trimmedData.memory.memory_comment === ""
        ) {
          validationErrors.push({
            field: "memory.memory_comment",
            message: "Memory comment should not be empty",
          });
        }

        const memoryBooleanFields = [
          "memory_naturality",
          "context_accuracy",
          "code_referencing",
          "remembers_debugging_history",
          "maintains_coding_style",
          "remembers_enviroment",
          "avoids_referencing_irrelevant_memory",
          "avoids_storing_irrelevant_memory",
        ];

        memoryBooleanFields.forEach((field) => {
          if (
            trimmedData.memory[field] &&
            !["yes", "no", "Yes", "No"].includes(trimmedData.memory[field])
          ) {
            validationErrors.push({
              field: `memory.${field}`,
              message: `${field} should be either 'yes' or 'no'`,
            });
          }
        });
      }

      setErrors(validationErrors);
      setIsValid(validationErrors.length === 0);
    } catch (error) {
      validationErrors.push({
        field: "json",
        message: "Invalid JSON format",
      });
      setErrors(validationErrors);
      setIsValid(false);
    }
  };

  const groupedErrors = errors.reduce((acc, error) => {
    const key =
      error.index !== undefined ? `prompts[${error.index}]` : "general";
    if (!acc[key]) acc[key] = [];
    acc[key].push(error);
    return acc;
  }, {} as Record<string, ValidationError[]>);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>JSON Validation Tool</CardTitle>
          <CardDescription>
            Validate your structured evaluation JSON data against the specified
            requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prompt-count">Number of Prompts</Label>
            <Input
              id="prompt-count"
              type="number"
              placeholder="Enter expected number of prompts"
              value={promptCount}
              onChange={(e) => setPromptCount(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="json-input">JSON Data</Label>
            <Textarea
              id="json-input"
              placeholder="Paste your JSON data here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <Button onClick={validateJson} className="w-full">
            Validate JSON
          </Button>
        </CardContent>
      </Card>

      {isValid !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isValid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Validation Passed
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Validation Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isValid ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All validation checks passed successfully!
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found {errors.length} validation error
                  {errors.length !== 1 ? "s" : ""}:
                </p>

                {Object.entries(groupedErrors).map(
                  ([section, sectionErrors]) => (
                    <div key={section} className="space-y-2">
                      <h4 className="font-semibold text-sm">
                        {section === "general" ? "General Issues" : section}
                      </h4>
                      <div className="space-y-2">
                        {sectionErrors.map((error, idx) => (
                          <Alert key={idx} variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {error.field}
                              </Badge>
                              {error.message}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
