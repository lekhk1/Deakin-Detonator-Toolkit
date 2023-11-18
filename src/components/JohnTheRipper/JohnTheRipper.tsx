import { Button, LoadingOverlay, NativeSelect, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCallback, useState } from "react";
import { CommandHelper } from "../../utils/CommandHelper";
import ConsoleWrapper from "../ConsoleWrapper/ConsoleWrapper";
import { writeTextFile, BaseDirectory } from "@tauri-apps/api/fs";
import { SaveOutputToTextFile } from "../SaveOutputToFile/SaveOutputToTextFile";
import { UserGuide } from "../UserGuide/UserGuide";

const modeRequiringWordList = ["dictionary"];
const modeRequiringIncrementOrder = ["increment"];

const title = "John the Ripper tool";
const descritpion_userguide =
    "John the Ripper is a popular and powerful open-source password cracking tool used to test the strength of passwords. It can be used by system administrators and security professionals to audit the passwords on their systems. John the Ripper is available for multiple platforms, including Unix, Windows, macOS, and DOS. It uses various techniques to crack passwords, such as dictionary attacks, brute-force attacks, and hybrid attacks. The tool is highly customizable and has a command-line interface, making it suitable for advanced users. John the Ripper is widely regarded as one of the most effective and efficient password cracking tools available." +
    "\n\nHow to use John the Ripper:" +
    "\n\nStep 1: Specify the filepath to the password file that you wish to crack. \nE.g /home/user/passwords.txt" +
    "\n\nStep 2: Specify the hash that is utilized in the password file. This field is mandatory, as you must specify the hash in order for John the Ripper to crack the password. A wide range of hashes are supported by the tool. \nE.g md5" +
    "\n\nStep 3: This specifies the format of the password file. A variety of file extensions are supported, including Unix password files, Windows SAM files, and more. This is necessary so as to enable John the Ripper to correctly read the file. \nE.g rar" +
    "\n\nStep 4: Click crack to commence the tool's execution." +
    "\n\nStep 5: View the output block below to view the results of the tool's execution.";

interface FormValuesType {
    filePath: string;
    hash: string;
    fileType: string;
    mode: string;
    wordlist: string;
    incrementorder: string;
}

const fileTypes = ["zip", "rar", "raw"];
const mode = ["incremental", "dictionary", "single"];
const incrementorder = [
    "ASCII",
    "LM_ASCII",
    "AlNum",
    "Alpha",
    "LowerNum",
    "UpperNum",
    "LowerSpace",
    "Lower",
    "Upper",
    "Digits",
    "LM_ASCII",
];

const JohnTheRipper = () => {
    const [loading, setLoading] = useState(false);
    const [output, setOutput] = useState("");
    const [selectedFileTypeOption, setSelectedFileTypeOption] = useState("");
    const [selectedModeOption, setselectedModeOption] = useState("");
    const [pid, setPid] = useState("");

    let form = useForm({
        initialValues: {
            filePath: "",
            hash: "",
            fileType: "",
            wordlist: "",
            mode: "",
            incrementorder: "",
        },
    });

    // Uses the callback function of runCommandGetPidAndOutput to handle and save data
    // generated by the executing process into the output state variable.
    const handleProcessData = useCallback((data: string) => {
        setOutput((prevOutput) => prevOutput + "\n" + data); // Update output
    }, []);

    // Uses the onTermination callback function of runCommandGetPidAndOutput to handle
    // the termination of that process, resetting state variables, handling the output data,
    // and informing the user.
    const handleProcessTermination = useCallback(
        ({ code, signal }: { code: number; signal: number }) => {
            if (code === 0) {
                handleProcessData("\nProcess completed successfully.");
            } else if (signal === 15) {
                handleProcessData("\nProcess was manually terminated.");
            } else {
                handleProcessData(`\nProcess terminated with exit code: ${code} and signal code: ${signal}`);
            }
            // Clear the child process pid reference
            setPid("");
            // Cancel the Loading Overlay
            setLoading(false);
        },
        [handleProcessData]
    );

    // Sends a SIGTERM signal to gracefully terminate the process
    const handleCancel = () => {
        if (pid !== null) {
            const args = [`-15`, pid];
            CommandHelper.runCommand("kill", args);
        }
    };

    const onSubmit = async (values: FormValuesType) => {
        setLoading(true);

        //if hash is stored in a textfile
        if (values.fileType === "raw") {
            //change argument according to mode selected
            const args = [``];
            if (selectedModeOption === "dictionary") {
                const args = [`--wordlist=${values.wordlist}`];
            } else if (selectedModeOption === "incremental") {
                const args = [`-incremental:${values.incrementorder}`];
            } else {
                const args = [`--single`];
            }

            try {
                const result = await CommandHelper.runCommand(`john ${values.filePath}`, args);
                setOutput(output + "\n" + result);
            } catch (e: any) {
                setOutput(e);
            }

            setLoading(false);
        } else {
            const args = [`${values.filePath}`];

            //extract password hash from zip/rar files
            try {
                const result = await CommandHelper.runCommand(`${values.fileType}2john`, args);
                await writeTextFile("hash.txt", result, { dir: BaseDirectory.Temp });
                setOutput(result);
            } catch (e: any) {
                setOutput(e);
            }

            //crack password
            try {
                const args = [`--wordlist=/usr/share/wordlists/john.lst`, "/tmp/hash.txt"];
                const result = await CommandHelper.runCommand("john", args);
                setOutput(output + "\n" + result);
            } catch (e: any) {
                setOutput(e);
            }

            setLoading(false);
        }
    };

    const clearOutput = useCallback(() => {
        setOutput("");
    }, [setOutput]);

    return (
        <form onSubmit={form.onSubmit((values) => onSubmit({ ...values, fileType: selectedFileTypeOption }))}>
            <LoadingOverlay visible={loading} />
            <Stack>
                {UserGuide(title, descritpion_userguide)}
                <TextInput label={"Filepath"} required {...form.getInputProps("filePath")} />
                <TextInput label={"Hash Type (if known)"} {...form.getInputProps("hash")} />
                <NativeSelect
                    value={selectedModeOption}
                    onChange={(e) => setselectedModeOption(e.target.value)}
                    title={"Crack Mode"}
                    data={mode}
                    required
                    placeholder={"Crack Mode"}
                    description={"Please select a crack mode"}
                />
                <NativeSelect
                    value={selectedFileTypeOption}
                    onChange={(e) => setSelectedFileTypeOption(e.target.value)}
                    title={"File Type"}
                    data={fileTypes}
                    required
                    placeholder={"File Type"}
                    description={"Please select the type of file you want to crack"}
                />
                {modeRequiringWordList.includes(selectedModeOption) && (
                    <>
                        <TextInput label={"Dictionary File Path"} required {...form.getInputProps("wordlist")} />
                    </>
                )}
                {modeRequiringIncrementOrder.includes(selectedModeOption) && (
                    <>
                        <TextInput label={"Increment Order"} required {...form.getInputProps("incrementorder")} />
                    </>
                )}

                <Button type={"submit"}>Crack</Button>
                {SaveOutputToTextFile(output)}
                <ConsoleWrapper output={output} clearOutputCallback={clearOutput} />
            </Stack>
        </form>
    );
};

export default JohnTheRipper;
