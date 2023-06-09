/**
 * Docker auto build & load image into Docker REST API
 * Ref from: https://github.com/mr-smithers-excellent/docker-build-push
 */

const core = require("@actions/core");
const github = require("@actions/github");
const cp = require("child_process");
const fs = require("fs");
const axios = require("axios");

const cpCfg = {
  stdio: "inherit",
  maxBuffer: 50 * 1024 * 1024,
};

(async () => {
  try {
    // Get config
    const imageRef = core.getInput("image", { required: false });
    const imageTag = core.getInput("version", { required: false });
    const dkFile = core.getInput("dockerfile", { required: false });
    const tcpURL = core.getInput("url", { required: true });

    // Get docker info
    await cp.execSync("docker info", cpCfg);
    // Get short sha
    const sha = github.context.sha.substring(0, 7);

    // Create image
    let imageName = "";
    if (!imageRef) {
      imageName += `${github.context.payload.repository.full_name.replace(
        "/",
        "-"
      )}-${sha}:${imageTag || "latest"}`;
    } else {
      imageName += `${imageRef}:${imageTag || "latest"}`;
    }
    // Check file is not exists
    if (!fs.existsSync(dkFile))
      throw new Error(
        "File " +
          dkFile +
          " not found. Please check your directory dockerfile is exist"
      );

    // Build it
    const fileExportName = `${sha}.tar`;
    console.log("⚙️ Building to image");
    await cp.execSync(`docker build -t ${imageName} ${dkFile}`, cpCfg);
    // Save image
    console.log("📝 Export to .tar file");
    await cp.execSync(`docker save ${imageName} > ${fileExportName}`, cpCfg);
    // Uploading to server
    console.log("📈 Uploading to server...");
    const stream = fs.createReadStream(`./${fileExportName}`);
    await axios.post(`${tcpURL}/images/load`, stream, {
      headers: {
        "Content-Type": "application/x-tar",
      },
    });

    console.log(`✅ N O I C E`);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
