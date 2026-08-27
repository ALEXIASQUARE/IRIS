class UpdateInfo {
  final int versionCode;
  final String version;
  final String apkUrl;
  final String? notes;

  UpdateInfo({required this.versionCode, required this.version, required this.apkUrl, this.notes});

  factory UpdateInfo.fromJson(Map<String, dynamic> json) => UpdateInfo(
        versionCode: json['versionCode'] as int,
        version: json['version'] as String,
        apkUrl: json['apkUrl'] as String,
        notes: json['notes'] as String?,
      );
}
