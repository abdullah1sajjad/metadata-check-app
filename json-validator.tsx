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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ValidationError {
  field: string;
  message: string;
  index?: number;
}

const metadataSchema = z
  .object({
    uuid: z.string().min(1, "UUID is required"),
    jira_id: z
      .string()
      .min(1, "JIRA ID is required")
      .startsWith("ANTHS-", "JIRA ID must start with 'ANTHS-'"),
    programming_language: z.string().min(1, "Programming language is required"),
    model: z.literal(
      "83aa91117c2fac3e25a3757eaa59f29ed3aeaf4dd7d3d384c673086c321e0644"
    ),
    root_gdrive: z.string().url("Must be a valid URL"),
    workflow: z.enum(["new_codebase", "existing_codebase"]),
    codebase: z.object({
      url: z.string().optional(),
      description: z.string().optional(),
    }),
    prompts: z.array(
      z
        .object({
          hfi_id: z.string(),
          prompt: z.string().min(1, "Prompt is required"),
          choice: z.number().min(0).max(7),
          gdrive: z.string().url("Must be a valid URL"),
          usecase: z.enum([
            "initial_development",
            "feature_implementation",
            "debugging_fixes",
            "optimization_testing",
          ]),
          comment: z.string().min(1, "Comment is required"),
          issue_type: z
            .enum([
              "missing_memory",
              "technical_inconsistency",
              "tool",
              "code_correctness",
              "setup",
              "other",
            ])
            .or(z.literal(""))
            .optional(),
          issue_comment: z.string().or(z.literal("")).optional(),
          issue_source: z.string().or(z.literal("")).optional(),
          level_of_correctness: z.number().min(-1).max(2),
          level_of_correctness_comment: z
            .string()
            .min(1, "Level of correctness comment is required"),
          memory_comment: z.string().min(1, "Memory comment is required"),
        })
        .refine(
          (data) => {
            if (data.level_of_correctness !== 2) {
              return (
                data.issue_type &&
                data.issue_comment &&
                data.issue_source &&
                data.issue_comment.trim() !== "" &&
                data.issue_source.trim() !== "" &&
                data.issue_type.trim() !== ""
              );
            }
            // If level_of_correctness is 2, allow empty string or undefined for issue fields
            return true;
          },
          {
            message:
              "Issue type, comment, and source are required when level of correctness is not 2",
            path: ["issue_type"],
          }
        )
    ),
    memory: z.object({
      memory_comment: z.string().min(1, "Memory comment is required"),
      memory_naturality: z.enum(["yes", "no"]),
      context_accuracy: z.enum(["yes", "no"]),
      code_referencing: z.enum(["yes", "no"]),
      remembers_debugging_history: z.enum(["yes", "no"]),
      maintains_coding_style: z.enum(["yes", "no"]),
      remembers_environment: z.enum(["yes", "no"]),
      avoids_referencing_irrelevant_memory: z.enum(["yes", "no"]),
      avoids_storing_irrelevant_memory: z.enum(["yes", "no"]),
    }),
  })
  .refine(
    (data) => {
      if (data.workflow === "existing_codebase") {
        return (
          data.codebase &&
          typeof data.codebase.url === "string" &&
          data.codebase.url.trim() !== "" &&
          typeof data.codebase.description === "string" &&
          data.codebase.description.trim() !== ""
        );
      } else {
        // For new_codebase, codebase fields must be empty or undefined
        return (
          !data.codebase ||
          ((data.codebase.url === undefined || data.codebase.url === "") &&
            (data.codebase.description === undefined || data.codebase.description === ""))
        );
      }
    },
    {
      message:
        "For existing codebase workflow, both URL and description are required. For new codebase, both must be empty.",
      path: ["codebase"],
    }
  );

type MetadataFormData = z.infer<typeof metadataSchema>;

export default function Component() {
  const [jsonInput, setJsonInput] = useState("");
  const [promptCount, setPromptCount] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const validateJson = () => {
    const validationErrors: ValidationError[] = [];

    try {
      const data = JSON.parse(jsonInput);
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
      }

      // Check prompts array length
      if (!data.prompts || !Array.isArray(data.prompts)) {
        validationErrors.push({
          field: "prompts",
          message: "Prompts array is missing or not an array",
        });
      } else if (data.prompts.length !== expectedPromptCount) {
        validationErrors.push({
          field: "prompts",
          message: `Prompts array length (${data.prompts.length}) does not match expected count (${expectedPromptCount})`,
        });
      }

      // Validate with Zod schema
      const result = metadataSchema.safeParse(data);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          // Convert Zod error to our ValidationError format
          const field = issue.path.join(".");
          const promptIndex = field.match(/prompts\.(\d+)/)?.[1];

          validationErrors.push({
            field: field,
            message: issue.message,
            index: promptIndex ? parseInt(promptIndex) : undefined,
          });
        });
      }

      // Check HFI ID matches UUID for each prompt
      if (data.prompts && Array.isArray(data.prompts) && data.uuid) {
        data.prompts.forEach((prompt: any, index: number) => {
          if (prompt.hfi_id !== data.uuid) {
            validationErrors.push({
              field: "hfi_id",
              message: "HFI ID should match the main UUID",
              index,
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

  const [generatedJson, setGeneratedJson] = useState<string>("");

  const form = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      uuid: "",
      jira_id: "ANTHS-",
      programming_language: "",
      model: "83aa91117c2fac3e25a3757eaa59f29ed3aeaf4dd7d3d384c673086c321e0644",
      root_gdrive: "",
      workflow: "new_codebase",
      codebase: {
        url: "",
        description: "",
      },
      prompts: [
        {
          hfi_id: "",
          prompt: "",
          choice: 0,
          gdrive: "",
          usecase: "initial_development",
          comment: "",
          level_of_correctness: 2,
          level_of_correctness_comment: "",
          memory_comment: "",
        },
      ],
      memory: {
        memory_comment: "",
        memory_naturality: "yes",
        context_accuracy: "yes",
        code_referencing: "yes",
        remembers_debugging_history: "yes",
        maintains_coding_style: "yes",
        remembers_environment: "yes",
        avoids_referencing_irrelevant_memory: "yes",
        avoids_storing_irrelevant_memory: "yes",
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prompts",
  });

  const onSubmit = (data: MetadataFormData) => {
    // Set hfi_id to match uuid for all prompts
    const processedData = {
      ...data,
      prompts: data.prompts.map((prompt) => ({
        ...prompt,
        hfi_id: data.uuid,
      })),
    };
    setGeneratedJson(JSON.stringify(processedData, null, 2));
    const { toast } = useToast();
    toast({
      title: "Metadata Generated",
      description: "Your metadata JSON has been generated successfully!",
    });
  };
  const { toast } = useToast();
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedJson);
    toast({
      title: "Copied!",
      description: "JSON copied to clipboard",
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>JSON Validation & Generation Tool</CardTitle>
          <CardDescription>
            Validate existing JSON data or generate new structured evaluation
            metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="checker" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="checker">Metadata Checker</TabsTrigger>
              <TabsTrigger value="generator">Metadata Generator</TabsTrigger>
            </TabsList>

            <TabsContent value="checker" className="space-y-4">
              {/* Existing validation logic */}
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
            </TabsContent>

            <TabsContent value="generator" className="space-y-4">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="uuid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UUID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter UUID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="jira_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>JIRA ID</FormLabel>
                          <FormControl>
                            <Input placeholder="ANTHS-..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="programming_language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Programming Language</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Python, JavaScript"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input {...field} disabled className="bg-muted" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="root_gdrive"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Root Google Drive URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://drive.google.com/..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="workflow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workflow</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select workflow type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new_codebase">
                              New Codebase
                            </SelectItem>
                            <SelectItem value="existing_codebase">
                              Existing Codebase
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("workflow") === "existing_codebase" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="codebase.url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Codebase URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://github.com/..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="codebase.description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Codebase Description</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Brief description of the codebase"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Prompts</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          append({
                            hfi_id: "",
                            prompt: "",
                            choice: 0,
                            gdrive: "",
                            usecase: "initial_development",
                            comment: "",
                            level_of_correctness: 2,
                            level_of_correctness_comment: "",
                            memory_comment: "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Prompt
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Prompt {index + 1}</h4>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`prompts.${index}.prompt`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Prompt</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Enter the prompt text"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.choice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Choice (0-7)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="7"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(Number(e.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.gdrive`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Google Drive URL</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://drive.google.com/..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.usecase`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Use Case</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="initial_development">
                                      Initial Development
                                    </SelectItem>
                                    <SelectItem value="feature_implementation">
                                      Feature Implementation
                                    </SelectItem>
                                    <SelectItem value="debugging_fixes">
                                      Debugging Fixes
                                    </SelectItem>
                                    <SelectItem value="optimization_testing">
                                      Optimization Testing
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.level_of_correctness`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Level of Correctness</FormLabel>
                                <Select
                                  onValueChange={(value) =>
                                    field.onChange(Number(value))
                                  }
                                  defaultValue={field.value?.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="0">0</SelectItem>
                                    <SelectItem value="-1">-1</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.comment`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Comment</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Enter comment"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.level_of_correctness_comment`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Level of Correctness Comment
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Comment on correctness level"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`prompts.${index}.memory_comment`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Memory Comment</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Comment on memory usage"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.watch(
                            `prompts.${index}.level_of_correctness`
                          ) !== 2 && (
                            <>
                              <FormField
                                control={form.control}
                                name={`prompts.${index}.issue_type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Issue Type</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select issue type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="missing_memory">
                                          Missing Memory
                                        </SelectItem>
                                        <SelectItem value="technical_inconsistency">
                                          Technical Inconsistency
                                        </SelectItem>
                                        <SelectItem value="tool">
                                          Tool
                                        </SelectItem>
                                        <SelectItem value="code_correctness">
                                          Code Correctness
                                        </SelectItem>
                                        <SelectItem value="setup">
                                          Setup
                                        </SelectItem>
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`prompts.${index}.issue_comment`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Issue Comment</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Describe the issue"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`prompts.${index}.issue_source`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Issue Source</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Source of the issue"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-4">
                      Memory Settings
                    </h3>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="memory.memory_comment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Memory Comment</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Overall memory comment"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="memory.memory_naturality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Memory Naturality</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.context_accuracy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Context Accuracy</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.code_referencing"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code Referencing</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.remembers_debugging_history"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Remembers Debugging History</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.maintains_coding_style"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maintains Coding Style</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.remembers_environment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Remembers Environment</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.avoids_referencing_irrelevant_memory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Avoids Referencing Irrelevant Memory
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="memory.avoids_storing_irrelevant_memory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Avoids Storing Irrelevant Memory
                              </FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="yes">Yes</SelectItem>
                                    <SelectItem value="no">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </Card>

                  <Button type="submit" className="w-full">
                    Generate Metadata JSON
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Validation Results (for checker tab) */}
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
